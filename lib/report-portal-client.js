/* eslint-disable class-methods-use-this,arrow-body-style */
const log = require('loglevel');
const uniqid = require('uniqid');
const Queue = require('easy-promise-queue').default;
const helpers = require('./helpers');
const RestClient = require('./rest');
const Tree = require('./flatTree');

const MULTIPART_BOUNDARY = Math.floor(Math.random() * 10000000000).toString();

const schedule = (queue, promiseProvider) => {
    return new Promise((resolve, reject) => {
        queue.add(() => {
            // add try/catch to avoid problems inside promise provider
            return promiseProvider()
                .then(resolve, reject);
            // .catch((e) => {
            //     reject(e); // we are rejecting only external promise ignoring problem with queue
            // });
            // .catch(reject);
        });
    });
};

const MAX_TIME_TO_WAIT_FOR_REQUESTS = 300000;
const REQUEST_CHECKING_INTERVAL = 500;

class RPClient {
    /**
     * Create a client for RP.
     * @param {Object} params - config object.
     * params should look like this
     * {
     *      token: "00000000-0000-0000-0000-000000000000",
     *      endpoint: "http://localhost:8080/api/v1",
     *      launch: "YOUR LAUNCH NAME",
     *      project: "PROJECT NAME",
     * }
     */
    constructor(params) {
        this.map = {}; // here we store test items of different kinds (suites, tests, methods)
        this.tree = new Tree();
        this.debug = params.debug || false;
        this.baseURL = params.endpoint;
        this.options = {
            headers: {
                Authorization: `bearer ${params.token}`,
            },
        };
        this.headers = {
            Authorization: `bearer ${params.token}`,
        };
        this.token = params.token;
        this.config = params;
        this.helpers = helpers;

        this.restClient = new RestClient({
            baseURL: this.baseURL,
            headers: this.headers,
        });

        this.queue = new Queue({
            concurrency: params.concurrency || 1,
        });

        log.setDefaultLevel(this.debug ? 'debug' : 'info');
    }

    getNewItemObj() {
        const obj = {
            realId: null,
            childrens: [],
            finishSend: false,
            // new item supposed to be active and scheduled for adding
            active: true, // checks whether promise for this completed
        };
        return obj;
    }

    isQueueEmpty() {
        return this.queue.ongoingCount === 0
            && this.queue.waitingCount === 0;
    }

    isItemActive(tempItemId) {
        // console.log('isItemIdActive', tempItemId);
        const tempItem = this.tree.getItem(tempItemId);
        if (!tempItem) {
            // console.log('no item');
            return false; // seems it was removed?
        }

        if (tempItem.active) {
            return true;
        }

        const activeChildren = this.tree
            .getChildren(tempItemId)
            .filter(child => child.active);

        return !!activeChildren.length;
    }

    waitForItemWillBeInactive(tempItemId, timeout = 50) {
        // console.log('wait temp item', tempItemId);
        const tempItem = this.tree.getItem(tempItemId);
        if (!tempItem) {
            return Promise.reject(new Error(`Item "${tempItemId}" not found`));
        }
        return helpers.waitForCondition(
            () => {
                // console.log(tempItem);
                return !this.isItemActive(tempItemId);
            },
            timeout,
            20,
        );

        // return Promise
        //     .resolve(tempItem.promise || true)
        //     .then(() => {
        //         if (!this.isItemActive(tempItemId)) {
        //             // log.debug('done imideatelly');
        //             return Promise.resolve(true);
        //         }

        //         let interval = null;
        //         let timeout = null;

        //         return new Promise((resolve, reject) => {
        //             timeout = setTimeout(() => {
        //                 clearInterval(interval);
        //                 if (!this.isItemActive(tempItemId)) {
        //                     // log.debug('done at the end');
        //                     resolve(true);
        //                 } else {
        //                     log.error(`Failed to wait till all requests completed in time [${
        //                         this.queue.ongoingCount}:${this.queue.waitingCount}]`);
        //                     reject(new Error('Failed to wait till all requests completed in time'));
        //                 }
        //             }, MAX_TIME_TO_WAIT_FOR_REQUESTS);

        //             interval = setInterval(() => {
        //                 if (!this.isItemActive(tempItemId)) {
        //                     // log.debug('done inside interval');
        //                     clearTimeout(timeout);
        //                     clearInterval(interval);
        //                     resolve(true);
        //                 }
        //             }, time_check);
        //         });
        //     });
    }

    // eslint-disable-next-line valid-jsdoc
    /**
     *
     * @private
     */
    cleanMap(ids) {
        ids.forEach((id) => {
            delete this.map[id];
        });
    }

    checkConnect() {
        return schedule(this.queue, () => this.restClient.retrieve('user', { headers: this.headers }));
    }

    /**
     * Start launch and report it.
     * @param {Object} launchDataRQ - request object.
     * launchDataRQ should look like this
     * {
     *     "description": "string" (support markdown),
     *     "mode": "DEFAULT" or "DEBUG",
     *     "name": "string",
     *     "start_time": this.helper.now(),
     *     "tags": [
     *         "string"
     *     ]
     * }
     * @returns an object which contains a tempID and a promise
     *
     * This method works in two ways:
     * First - If launchDataRQ object doesn't contain ID field,
     * it would create a new Launch instance at the Report Portal with it ID.
     * Second - If launchDataRQ would contain ID field,
     * client would connect to the existing Launch which ID
     * has been sent , and would send all data to it.
     * Notice that Launch which ID has been sent must be 'IN PROGRESS' state at the Report Portal
     * or it would throw an error.
     * @returns {Object} - an object which contains a tempID and a promise
     */
    startLaunch(launchDataRQ) {
        const cleanItemObj = this.getNewItemObj();
        const launchTempItem = this.tree.addItem(cleanItemObj);
        const launchTempId = launchTempItem.id;
        // launchTempItem.active = true;
        log.debug(`Start launch ${launchTempId}`);
        launchTempItem.promise = Promise.resolve(true)
            .then(() => { launchTempItem.active = true; })
            .then(() => {
                if (launchDataRQ.id) {
                    launchTempItem.realId = launchDataRQ.id;
                    return schedule(this.queue, () => Promise
                        .resolve(() => {
                            launchTempItem.active = false;
                            return {
                                id: launchDataRQ.id,
                            };
                        }));
                }
                // else {
                const launchData =
                    Object.assign(
                        {
                            name: this.config.launch || 'Test launch name',
                            start_time: this.helpers.now(),
                        },
                        launchDataRQ,
                    );
                const url = [this.config.project, 'launch'].join('/');

                return schedule(this.queue, () => {
                    // launchTempItem.active = true;
                    return this.restClient.create(url, launchData, { headers: this.headers })
                        .then((response) => {
                            log.debug(`Success start launch ${response.id}`);
                            launchTempItem.realId = response.id;
                            launchTempItem.active = false;
                            return response;
                        }, (error) => {
                            launchTempItem.active = false;
                            log.debug(`Error start launch ${launchTempId}`);
                            log.debug(error.message);
                            throw new Error(error);
                        });
                });
                // }
            });

        // launchTempItem.promise = promise; // add promise to temp item

        return {
            tempId: launchTempId,
            promise: launchTempItem.promise,
        };
    }

    /**
     * Finish launch.
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {Object} finishExecutionRQ - finish launch info should include time and status.
     * finishExecutionRQ should look like this (optional....)
     * {
     *      "end_time": this.helper.now(),
     *      "status": "PASSED" or one of ‘PASSED’, ‘FAILED’, ‘STOPPED’, ‘SKIPPED’, ‘RESTED’, ‘CANCELLED’
     * }
     * @returns {Object} - an object which contains a tempID and a promise
     */
    finishLaunch(launchTempId, finishExecutionRQ) {
        const launchTempItem = this.tree.getItem(launchTempId);
        // launchTempItem.active = true;
        launchTempItem.promise = this.waitForItemWillBeInactive(launchTempId)
            .then(() => { launchTempItem.active = true; })
            .then(() => schedule(this.queue, () => {
                // const launchTempItem = this.tree.getItem(launchTempId);
                if (!launchTempItem) {
                    return Promise.reject(new Error(`Launch "${launchTempId}" not found`));
                }
                if (!launchTempItem.realId) {
                    return Promise.reject(new Error('There is no realId fetched for launch'));
                }

                const finishExecutionData = Object.assign({
                    end_time: this.helpers.now(),
                    status: '',
                }, finishExecutionRQ);

                launchTempItem.active = true;

                log.debug(`Finish launch ${launchTempId}`);
                const url = [this.config.project, 'launch', launchTempItem.realId, 'finish'].join('/');
                return this.restClient.update(url, finishExecutionData, { headers: this.headers })
                    .then((response) => {
                        log.debug(`Success finish launch ${launchTempId}`);
                        launchTempItem.finishSend = true;
                        launchTempItem.active = false;
                        return response;
                    }, (error) => {
                        launchTempItem.active = false;
                        log.debug(`Error finish launch ${launchTempId}`);
                        log.debug(error.message);
                        throw new Error(error);
                    });
            }));

        return {
            tempId: launchTempId,
            promise: launchTempItem.promise,
        };
    }

    /**
     * This method is used for frameworks as Jasmine. There is problem when
     * it doesn't wait for promise resolve and stop the process. So it better to call
     * this method at the spec's function as @afterAll() and manually resolve this promise.
     * @param {*} launchTempId - temp launch id which should be checked
     * @returns {Promise} - returns promise for all items.
     */
    getPromiseFinishAllItems(launchTempId) {
        const launchTempItem = this.tree.getItem(launchTempId); // todo drop it

        if (!launchTempItem) {
            return Promise.reject(new Error(`Launch "${launchTempId}" not found`));
        }

        if (this.isQueueEmpty()) {
            return Promise.resolve(true);
        }

        let interval = null;
        let timeout = null;

        return new Promise((resolve, reject) => {
            timeout = setTimeout(() => {
                clearInterval(interval);
                if (this.isQueueEmpty()) {
                    resolve(true);
                } else {
                    log.error(`Failed to wait till all requests completed in time [${
                        this.queue.ongoingCount}:${this.queue.waitingCount}]`);
                    reject(new Error('Failed to wait till all requests completed in time'));
                }
            }, MAX_TIME_TO_WAIT_FOR_REQUESTS);

            interval = setInterval(() => {
                if (this.isQueueEmpty()) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve(true);
                }
            }, REQUEST_CHECKING_INTERVAL);
        });
    }

    /**
     * Update launch.
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {Object} launchData - new launch data
     * launchData should look like this
     * {
     *     "description": "string" (support markdown),
     *     "mode": "DEFAULT" or "DEBUG",
     *     "tags": [
     *         "string"
     *     ]
     * }
     * @returns {Object} - an object which contains a tempId and a promise
     */
    updateLaunch(launchTempId, launchData) {
        log.debug('Update launch', launchTempId);
        const launchTempItem = this.tree.getItem(launchTempId);
        // launchTempItem.active = true;
        launchTempItem.promise = this.waitForItemWillBeInactive(launchTempId)
            .then(() => { launchTempItem.active = true; })
            .then(() => schedule(this.queue, () => {
                // const launchTempItem = this.tree.getItem(launchTempId);
                if (!launchTempItem) {
                    return Promise.reject(new Error(`Launch "${launchTempId}" not found`));
                }
                if (!launchTempItem.realId) {
                    // here can be problem if test launched early then
                    return Promise.reject(new Error('There is no realId fetched for launch'));
                }

                launchTempItem.active = true;
                const url = [this.config.project, 'launch', launchTempItem.realId, 'update'].join('/');
                return this.restClient.update(url, launchData, { headers: this.headers })
                    .then((response) => {
                        log.debug(`Success update launch ${launchTempId}`);
                        launchTempItem.active = false;
                        return response;
                    }, (error) => {
                        launchTempItem.active = false;
                        log.debug(`Error update launch ${launchTempId}`);
                        log.debug(error.message);
                        throw new Error(error);
                    });
            }));

        return {
            tempId: launchTempId,
            promise: launchTempItem.promise,
        };
    }

    /**
     * If there is no parentItemId starts Suite, else starts test or item.
     * @param {Object} testItemDataRQ - object with item parameters
     * testItemDataRQ should look like this
     * {
     *       "description": "string" (support markdown),
     *       "name": "string",
     *       "start_time": this.helper.now(),
     *        "tags": [
     *          "string"
     *        ],
     *       "type": 'SUITE' or one of 'SUITE', 'STORY', 'TEST',
     *               'SCENARIO', 'STEP', 'BEFORE_CLASS', 'BEFORE_GROUPS',
     *               'BEFORE_METHOD', 'BEFORE_SUITE', 'BEFORE_TEST',
     *               'AFTER_CLASS', 'AFTER_GROUPS', 'AFTER_METHOD',
     *               'AFTER_SUITE', 'AFTER_TEST'
     *   }
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {string} parentTempId (optional) - temp item id (returned in the query "startTestItem").
     * @returns {Object} - an object which contains a tempId and a promise
     */
    startTestItem(testItemDataRQ, launchTempId, parentTempId) {
        // const tempId = uniqid();
        const cleanItemObj = this.getNewItemObj();
        const testItemTempItem = this.tree.addItem(cleanItemObj);
        const testItemTempId = testItemTempItem.id;
        testItemTempItem.active = true;
        testItemTempItem.promise = this.waitForItemWillBeInactive(parentTempId || launchTempId)
            .then(() => schedule(this.queue, () => {
                let parentId = launchTempId;
                const launchTempItem = this.tree.getItem(launchTempId);
                if (!launchTempItem) {
                    return Promise.reject(new Error(`Launch "${launchTempId}" not found`));
                }
                if (launchTempItem.finishSend) {
                    return Promise.reject(new Error(`Launch "${
                        launchTempId}" is already finished, you can not add an item to it`));
                }

                const testItemData = Object.assign({ start_time: this.helpers.now() }, testItemDataRQ);

                if (parentTempId) {
                    parentId = parentTempId;
                    const parentTempItem = this.tree.getItem(parentTempId);
                    if (!parentTempItem) {
                        return Promise.reject(new Error(`Item "${parentTempId}" not found`));
                    }
                }

                const realLaunchId = launchTempItem.realId;
                let url = [this.config.project, 'item'].join('/');
                if (parentTempId) {
                    const realParentId = this.tree.getItem(parentTempId).realId;
                    url += `/${realParentId}`;
                }
                testItemData.launch_id = realLaunchId;
                log.debug(`Start test item ${testItemDataRQ.type} ${testItemTempId}`);

                testItemTempItem.active = true;
                this.tree.addItem(testItemTempItem, parentId);
                return this.restClient.create(url, testItemData, { headers: this.headers })
                    .then((response) => {
                        testItemTempItem.active = false;
                        log.debug(`Success start item ${testItemDataRQ.type} ${testItemTempId} ${parentId}`);
                        testItemTempItem.realId = response.id;
                        return response;
                    }, (error) => {
                        testItemTempItem.active = false;
                        log.debug(`Error start item ${testItemTempId}:`);
                        throw new Error(error);
                    });
            }));

        return {
            tempId: testItemTempId,
            promise: testItemTempItem.promise,
        };
    }

    /**
     * Finish Suite or Step level.
     * @param {string} testItemTempId - temp item id (returned in the query "startTestItem").
     * @param {Object} finishTestItemRQ - object with item parameters.
     * finishTestItemRQ should look like this
     * {
     *   "end_time": this.helper.now(),
     *   "issue": {
     *     "comment": "string",
     *     "externalSystemIssues": [
     *       {
     *         "submitDate": 0,
     *         "submitter": "string",
     *         "systemId": "string",
     *         "ticketId": "string",
     *         "url": "string"
     *       }
     *     ],
     *     "issue_type": "string"
     *   },
     *   "status": "PASSED" or one of 'PASSED', 'FAILED', 'STOPPED', 'SKIPPED', 'RESETED', 'CANCELLED'
     * }
     * @returns {Object} - an object which contains a tempId and a promise
     */
    finishTestItem(testItemTempId, finishTestItemRQ) {
        const testItemTempItem = this.tree.getItem(testItemTempId);
        testItemTempItem.active = true;
        testItemTempItem.promise = this.waitForItemWillBeInactive(testItemTempId)
            .then(() => schedule(this.queue, () => {
                // const testItemTempItem = this.tree.getItem(testItemTempId);
                if (!testItemTempItem) {
                    return Promise.reject(new Error(`Item "${testItemTempId}" not found`));
                }

                const finishTestItemData = Object.assign({
                    end_time: this.helpers.now(),
                    status: 'PASSED',
                }, finishTestItemRQ);

                testItemTempItem.finishSend = true;

                this.tree.removeAllChildren(testItemTempId);
                return this.finishTestItemPromiseStart(testItemTempItem, testItemTempId, finishTestItemData);
            }));

        return {
            tempId: testItemTempId,
            // todo should be checked that requests for this item completed and it doesn't have any children running
            promise: testItemTempItem.promise,
        };
    }

    saveLog(testItemTempId, requestPromiseFunc) {
        const cleanItemObj = this.getNewItemObj();
        const logItemTempItem = this.tree.addItem(cleanItemObj);
        const logItemTempId = logItemTempItem.id;

        return {
            tempId: logItemTempId,
            // todo should be checked that requests for this item completed and it doesn't have any children running
            promise: schedule(this.queue, () => {
                const testItemTempItem = this.tree.getItem(testItemTempId);
                if (!testItemTempItem) {
                    return Promise.reject(new Error(`Item "${testItemTempId}" not found`));
                }

                log.debug(`Save log ${logItemTempId}`);
                logItemTempItem.active = true;
                return requestPromiseFunc(testItemTempItem.realId)
                    .then((response) => {
                        log.debug(`Successfully save log ${logItemTempId}`);
                        // resolve(response);
                        logItemTempItem.active = false;
                        this.tree.addChild(logItemTempItem, testItemTempId);
                        logItemTempItem.finishSend = true;
                        return response;
                    }, (error) => {
                        logItemTempItem.active = false;
                        log.debug(`Error finish log: ${error}`);
                    });
            }),
        };
    }

    sendLog(itemTempId, saveLogRQ, fileObj) {
        const saveLogData = Object.assign({
            time: this.helpers.now(),
            message: '',
            level: '',
        }, saveLogRQ);

        if (fileObj) {
            return this.sendLogWithFile(itemTempId, saveLogData, fileObj);
        }
        return this.sendLogWithoutFile(itemTempId, saveLogData);
    }

    /**
     * Send log of test results.
     * @param {string} itemTempId - temp item id (returned in the query "startTestItem").
     * @param {Object} saveLogRQ - object with data of test result.
     * saveLogRQ should look like this
     * {
     *      level: 'error' or one of 'trace', 'debug', 'info', 'warn', 'error', '',
     *      message: 'string' (support markdown),
     *      time: this.helpers.now()
     * }
     * @returns {Object} - an object which contains a tempId and a promise
     */
    sendLogWithoutFile(itemTempId, saveLogRQ) {
        const requestPromise = (id) => {
            const url = [this.config.project, 'log'].join('/');
            // eslint-disable-next-line no-param-reassign
            saveLogRQ.item_id = id;
            return this.restClient.create(url, saveLogRQ, { headers: this.headers });
        };
        return this.saveLog(itemTempId, requestPromise);
    }
    /**
     * Send log of test results with file.
     * @param {string} itemTempId - temp item id (returned in the query "startTestItem").
     * @param {Object} saveLogRQ - object with data of test result.
     * saveLogRQ should look like this
     * {
     *      level: 'error' or one of 'trace', 'debug', 'info', 'warn', 'error', '',
     *      message: 'string' (support markdown),
     *      time: this.helpers.now()
     * }
     * @param {Object} fileObj - object with file data.
     * fileObj should look like this
     * {
     *     name: 'string',
     *     type: "image/png" or your file mimeType
     *       (supported types: 'image/*', application/ ['xml', 'javascript', 'json', 'css', 'php'],
     *       another format will be opened in a new browser tab ),
     *     content: file
     * }
     * @returns {Object} - an object which contains a tempId and a promise
     */
    sendLogWithFile(itemTempId, saveLogRQ, fileObj) {
        const requestPromise = (id) => {
            // eslint-disable-next-line no-param-reassign
            saveLogRQ.item_id = id;
            return this.getRequestLogWithFile(saveLogRQ, fileObj);
        };
        return this.saveLog(itemTempId, requestPromise);
    }

    getRequestLogWithFile(saveLogRQ, fileObj) {
        const url = [this.config.project, 'log'].join('/');
        // eslint-disable-next-line no-param-reassign
        saveLogRQ.file = { name: fileObj.name };
        return this.restClient.create(
            url,
            this.buildMultiPartStream([saveLogRQ], fileObj, MULTIPART_BOUNDARY),
            {
                headers: {
                    Authorization: `bearer ${this.token}`,
                    'Content-Type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
                },
            },
        )
            .then((response) => {
                return response;
            })
            .catch((error) => {
                log.debug('ERROR');
                log.debug(error);
            });
    }

    // eslint-disable-next-line valid-jsdoc
    /**
     * @param {*} jsonPart - json object which reprsents log message
     * @param {*} filePart - attachmen which will be added to log message
     * @param {*} boundary - delimeter for multi parts
     * @private
     */
    buildMultiPartStream(jsonPart, filePart, boundary) {
        const eol = '\r\n';
        const bx = `--${boundary}`;
        const buffers = [
            // eslint-disable-next-line function-paren-newline
            Buffer.from(
                // eslint-disable-next-line prefer-template
                bx + eol + 'Content-Disposition: form-data; name="json_request_part"' +
                eol + 'Content-Type: application/json' + eol +
                eol + eol + JSON.stringify(jsonPart) + eol),
            // eslint-disable-next-line function-paren-newline
            Buffer.from(
                // eslint-disable-next-line prefer-template
                bx + eol + 'Content-Disposition: form-data; name="file"; filename="' + filePart.name + '"' + eol +
                'Content-Type: ' + filePart.type + eol + eol),
            Buffer.from(filePart.content, 'base64'),
            Buffer.from(`${eol + bx}--${eol}`),
        ];
        return Buffer.concat(buffers);
    }

    // todo remove this line
    /* eslint-disable no-param-reassign */
    finishTestItemPromiseStart(testItemTempItem, testItemTempId, finishTestItemData) {
        const url = [this.config.project, 'item', testItemTempItem.realId].join('/');
        log.debug(`Finish test item ${testItemTempId}`);
        testItemTempItem.active = true;
        return this.restClient.update(url, finishTestItemData, { headers: this.headers })
            .then((response) => {
                testItemTempItem.active = false;
                log.debug(`Success finish item ${testItemTempId}`);
                return response;
            }, (error) => {
                testItemTempItem.active = false;
                log.debug(`Error finish test item ${testItemTempId}`);
                log.debug(error);
                throw new Error(error);
            });
    }
}

module.exports = RPClient;
