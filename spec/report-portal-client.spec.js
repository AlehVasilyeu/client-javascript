const nock = require('nock');
const isEqual = require('lodash/isEqual');
const RPClient = require('../lib/report-portal-client.js');
const helpers = require('../lib/helpers');

/* CLIENT CONFIGURATION */

const TEST_PROJECT = 'mycoolproject';

const config = {
    token: '00000000-0000-0000-0000-000000000000',
    endpoint: 'http://report-portal-host:8080/api/v1',
    launch: 'LAUNCH_NAME',
    project: TEST_PROJECT,
    description: 'Lunch description (optional)',
    tags: [
        'tag1',
        'tag2',
    ],
};

const userResponseData = {
    userId: 'user',
    email: 'user@example.com',
    full_name: 'User',
    account_type: 'INTERNAL',
    userRole: 'ADMINISTRATOR',
    last_login: 1547726227194,
    photo_loaded: true,
    default_project: TEST_PROJECT,
    assigned_projects: {
        mycoolproject: {
            projectRole: 'PROJECT_MANAGER',
            proposedRole: 'PROJECT_MANAGER',
            entryType: 'INTERNAL',
        },
        user_personal: {
            projectRole: 'PROJECT_MANAGER',
            proposedRole: 'PROJECT_MANAGER',
            entryType: 'PERSONAL',
        },
    },
};

/** LAUNCH TEST DATA */

const REAL_LAUNCH_ID = '5c40bf5624aa9a00058d2c49';
const TEMP_LAUNCH_ID = 'temp-11111111111';
const UNEXISTENT_TEMP_LAUNCH_ID = 'unexistentLaunchId';

const LAUNCH_DATA = {
    name: 'Client test',
    start_time: helpers.now(),
    description: 'DESCRIPTION',
    tags: ['your', 'tags'],
};

/** SUITE TEST DATA */

const REAL_SUITE_ID = '5c40bf5624aa9a00058d2c48';
const TEMP_SUITE_ID = 'temp-22222222222';
const UNEXISTENT_TEMP_SUITE_ID = 'unexistentSuiteId';

const SUITE_DATA = {
    description: 'SUITE',
    name: 'SUITE',
    start_time: helpers.now(),
    type: 'SUITE',
};

/** STEP TEST DATA */

const REAL_STEP_ID = '5c40bf5624aa9a00058d2c47';
const TEMP_STEP_ID = 'temp-33333333333';
const UNEXISTENT_TEMP_STEP_ID = 'unexistentStepId';

const STEP_DATA = {
    description: 'uniqid()',
    name: 'uniqid()',
    start_time: helpers.now(),
    type: 'STEP',
};

/** LOG TEST DATA */

const REAL_LOG_ID = '5c433da624aa9a00058d34c8';
const TEMP_LOG_ID = 'temp-44444444444';

const LOG_MESSAGE = {
    level: 'INFO',
    message: 'Screenshot',
    time: helpers.now(),
};

const LOG_ATTACHMENT = {
    name: 'Screenshot',
    type: 'image/png',
    content: 'N43T8qPZoAAAAASUVORK5CYII=',
};

/* RESPONSES AND ERRORS */

const unauthorizedErrorMessage = 'Request failed with status code 403: '
    + '{"error":"unauthorized","error_description":"Full authentication is required to access this resource"}';

const unathorizedErrorResponseMessage = {
    error: 'unauthorized',
    error_description: 'Full authentication is required to access this resource',
};

const realLaunchUpdateResponseMessage = {
    msg: `Launch with ID = '${REAL_LAUNCH_ID}' successfully updated.`,
};

const realLaunchFinishResponseMessage = {
    msg: `Launch with ID = '${REAL_LAUNCH_ID}' successfully finished.`,
};

const realItemFinishedResponseMessage = {
    msg: `TestItem with ID = '${REAL_SUITE_ID}' successfully finished.`,
};

/* OTHER */

const canonicalLengthOfTempUniqueId = 15;

/* UTILITIY */

const noop = () => { };

const copy = (obj, mixin) => {
    // we use this for copying without mutation...
    const copyOfObj = Object.assign({}, obj);
    const copyOfMixin = Object.assign({}, mixin);

    // we assign to object only properties from mixin that are not defined in target object
    return Object.assign(copyOfMixin, copyOfObj);
};

const swallowPromise = (promise, done) => {
    promise
        .then(noop)
        .catch(noop)
        .then(done);
};

describe('ReportPortal javascript client', () => {
    /**
     * @type RPClient
     */
    let client;

    beforeEach(() => {
        client = new RPClient(config);
        // client.map = {};

        // // setting launch data, like existing one.
        // client.map[TEMP_LAUNCH_ID] = {
        //     realId: REAL_LAUNCH_ID,
        //     childrens: [TEMP_SUITE_ID],
        //     finishSend: false,
        // };

        // // add suite to launch
        // client.map[TEMP_SUITE_ID] = {
        //     realId: REAL_SUITE_ID,
        //     childrens: [TEMP_STEP_ID],
        //     finishSend: false,
        // };

        // // add step to suite
        // client.map[TEMP_STEP_ID] = {
        //     realId: REAL_STEP_ID,
        //     childrens: [TEMP_LOG_ID],
        //     finishSend: false,
        // };

        // // add log to step
        // client.map[TEMP_LOG_ID] = {
        //     realId: REAL_LOG_ID,
        //     childrens: [],
        //     finishSend: true,
        // };


        // add the same way to tree
        // setting launch data, like existing one.
        client.tree.items[TEMP_LAUNCH_ID] = {
            id: TEMP_LAUNCH_ID,
            realId: REAL_LAUNCH_ID,
            children: [TEMP_SUITE_ID],
            childrens: [TEMP_SUITE_ID], // todo drop it
            finishSend: false,
            active: false,
        };

        // add suite to launch
        client.tree.items[TEMP_SUITE_ID] = {
            id: TEMP_SUITE_ID,
            realId: REAL_SUITE_ID,
            children: [TEMP_STEP_ID],
            childrens: [TEMP_STEP_ID], // todo drop it
            finishSend: false,
            active: false,
        };

        // add step to suite
        client.tree.items[TEMP_STEP_ID] = {
            id: TEMP_STEP_ID,
            realId: REAL_STEP_ID,
            children: [TEMP_LOG_ID],
            childrens: [TEMP_LOG_ID], // todo drop it
            finishSend: false,
            active: false,
        };

        // add log to step
        client.tree.items[TEMP_LOG_ID] = {
            id: TEMP_LOG_ID,
            realId: REAL_LOG_ID,
            children: [],
            childrens: [], // todo drop it
            finishSend: true,
            active: false,
        };
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('constructor', () => {
        it('creates object with correct properties', () => {
            // map is empty
            // const client = new RPClient({ token: 'test' });
            const customClient = new RPClient(config);

            expect(Object.keys(customClient.map).length).toEqual(0);
            expect(Object.keys(customClient.tree.items).length).toEqual(0);
            expect(customClient.config.token).toBe(config.token);
            expect(customClient.debug).toBe(false);
            expect(customClient.baseURL).toBe(config.endpoint);
            expect(customClient.options).toEqual({
                headers: {
                    Authorization: `bearer ${config.token}`,
                },
            });
            expect(customClient.headers).toEqual({
                Authorization: `bearer ${config.token}`,
            });
            expect(customClient.token).toBe(config.token);
            expect(customClient.config).toEqual(config);
            expect(customClient.helpers).toBeDefined();
            expect(customClient.restClient).toBeDefined();
            expect(customClient.queue).toBeDefined();
        });

        it('inits RestClient correctly', () => {
            expect(client.restClient.baseURL).toBe(config.endpoint);
            expect(client.restClient.headers).toEqual({
                Authorization: `bearer ${config.token}`,
            });
        });

        it('inits Queue correctly', () => {
            // eslint-disable-next-line no-underscore-dangle
            expect(client.queue._concurrency).toBe(1);
        });

        it('turns on debug', (done) => {
            spyOn(console, 'log');
            const customClient = new RPClient(copy({ debug: true }, config));
            const launchData = copy({}, LAUNCH_DATA);

            const { tempId, promise } = customClient.startLaunch(launchData);

            expect(customClient.debug).toBe(true);
            promise.catch(() => {
                // eslint-disable-next-line no-console
                expect(console.log).toHaveBeenCalledWith(`Start launch ${tempId}`);
                done();
            });
        });

        it('set up concurrency for queue', () => {
            const customClient = new RPClient(copy({ concurrency: 2 }, config));
            // eslint-disable-next-line no-underscore-dangle
            expect(customClient.queue._concurrency).toBe(2);
        });
    });

    describe('#getNewItemObj', () => {
        it('returns new clean object for requests every time', () => {
            const expectedItemObj = {
                realId: null,
                childrens: [],
                finishSend: false,
                active: false,
            };

            const newItemObj = client.getNewItemObj();

            expect(newItemObj).toEqual(expectedItemObj);
        });
    });

    xdescribe('#cleanMap', () => {
        it('removes all specified items from "map"', () => {
            client.cleanMap([
                TEMP_LAUNCH_ID,
                TEMP_SUITE_ID,
                TEMP_STEP_ID,
                TEMP_LOG_ID,
            ]);

            expect(client.map).toBeDefined();
            expect(Object.keys(client.map).length).toBe(0);
        });
    });

    describe('#checkConnect', () => {
        it('returns promise with user data for token', (done) => {
            const scope = nock(config.endpoint)
                .get('/user')
                .reply(200, userResponseData);

            client.checkConnect().then((user) => {
                expect(user).toEqual(userResponseData);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    describe('#startLaunch', () => {
        it('returns object with promise and tempId', (done) => {
            const launchObject = client.startLaunch({});

            expect(typeof launchObject.tempId === 'string').toBeTruthy();
            expect(launchObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(launchObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(launchObject.promise, done);
        });

        it('resolves promise with stored realId', (done) => {
            const launchData = copy({ id: REAL_LAUNCH_ID }, LAUNCH_DATA);

            const launchObject = client.startLaunch(launchData);

            launchObject.promise.then((result) => {
                expect(result).toEqual({ id: REAL_LAUNCH_ID });
                done();
            });
        });

        it('resolves promise with new realId', (done) => {
            const launchData = copy({}, LAUNCH_DATA);
            const response = { id: REAL_LAUNCH_ID };

            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/launch`, body => isEqual(body, launchData))
                .reply(201, response);

            client.startLaunch(launchData).promise.then((result) => {
                expect(result).toEqual(response);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('rejects promise with error in case of API error', (done) => {
            const launchData = copy({}, LAUNCH_DATA);

            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/launch`)
                .reply(403, unathorizedErrorResponseMessage);

            client.startLaunch(launchData).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    describe('#updateLaunch', () => {
        it('returns object with promise and tempId', (done) => {
            const launchObject = client.updateLaunch(TEMP_LAUNCH_ID, {});

            expect(typeof launchObject.tempId === 'string').toBeTruthy();
            expect(launchObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(launchObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(launchObject.promise, done);
        });

        it('resolves promise with correct response message', (done) => {
            const launchData = copy({}, LAUNCH_DATA);

            const scope = nock(config.endpoint)
                .put(`/${TEST_PROJECT}/launch/${REAL_LAUNCH_ID}/update`)
                .reply(200, realLaunchUpdateResponseMessage);

            const launchObject = client.updateLaunch(TEMP_LAUNCH_ID, launchData);

            launchObject.promise.then((result) => {
                expect(result).toEqual(realLaunchUpdateResponseMessage);

                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('rejects promise with error if launch was not found by tempId', (done) => {
            client.updateLaunch(UNEXISTENT_TEMP_LAUNCH_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Launch "${UNEXISTENT_TEMP_LAUNCH_ID}" not found`);
                done();
            });
        });

        it('rejects promise with error if launch doesnt have realId', (done) => {
            client.tree.getItem(TEMP_LAUNCH_ID).realId = null;

            client.updateLaunch(TEMP_LAUNCH_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch('There is no realId fetched for launch');
                done();
            });
        });

        it('rejects promise with error in case of API error', (done) => {
            const launchData = copy({}, LAUNCH_DATA);

            const scope = nock(config.endpoint)
                .put(`/${TEST_PROJECT}/launch/${REAL_LAUNCH_ID}/update`)
                .reply(403, unathorizedErrorResponseMessage);

            client.updateLaunch(TEMP_LAUNCH_ID, launchData).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    describe('#finishLaunch', () => {
        it('returns object with promise and tempId', (done) => {
            const launchObject = client.finishLaunch(TEMP_LAUNCH_ID);

            // todo check that old tempId is returned
            expect(typeof launchObject.tempId === 'string').toBeTruthy();
            expect(launchObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(launchObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(launchObject.promise, done);
        });

        it('resolves promise with correct response message', (done) => {
            const launchData = copy({ end_time: helpers.now() }, LAUNCH_DATA);

            const scope = nock(config.endpoint)
                .put(`/${TEST_PROJECT}/launch/${REAL_LAUNCH_ID}/finish`)
                // .post(`/${TEST_PROJECT}/launch/${TEST_LAUNCH_ID}/finish`, body => isEqual(body, launchData))
                .reply(200, realLaunchFinishResponseMessage);

            const launchObject = client.finishLaunch(TEMP_LAUNCH_ID, launchData);

            launchObject.promise.then((result) => {
                expect(result).toEqual(realLaunchFinishResponseMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('rejects promise with error if launch was not found by tempId', (done) => {
            client.finishLaunch(UNEXISTENT_TEMP_LAUNCH_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Launch "${UNEXISTENT_TEMP_LAUNCH_ID}" not found`);
                done();
            });
        });

        it('rejects promise with error if launch doesnt have reaId', (done) => {
            client.tree.getItem(TEMP_LAUNCH_ID).realId = null;

            client.finishLaunch(TEMP_LAUNCH_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch('There is no realId fetched for launch');
                done();
            });
        });

        it('rejects promise with error in case of API error', (done) => {
            const launchData = copy({}, LAUNCH_DATA);

            const scope = nock(config.endpoint)
                .put(`/${TEST_PROJECT}/launch/${REAL_LAUNCH_ID}/finish`)
                .reply(403, unathorizedErrorResponseMessage);

            client.finishLaunch(TEMP_LAUNCH_ID, launchData).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    describe('#getPromiseFinishAllItems', () => {
        it('rejects promise if there is no launch for tempId', (done) => {
            client.getPromiseFinishAllItems(UNEXISTENT_TEMP_LAUNCH_ID).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Launch "${UNEXISTENT_TEMP_LAUNCH_ID}" not found`);
                done();
            });
        });

        it('rejects promise with error', (done) => {
            jasmine.clock().install();

            nock(config.endpoint)
                .get('/user')
                .times(3)
                .delay(50)
                .reply(200, userResponseData);

            client.checkConnect().then(noop);
            client.checkConnect().then(noop);
            client.checkConnect().then(noop);

            expect(client.queue.ongoingCount).toEqual(1);
            expect(client.queue.waitingCount).toEqual(2);

            client.getPromiseFinishAllItems(TEMP_LAUNCH_ID).catch((error) => {
                // expect(scope.isDone()).toBeTruthy();

                expect(client.queue.ongoingCount).toEqual(1);
                expect(client.queue.waitingCount).toEqual(2);

                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch('Failed to wait till all requests completed in time');

                client.getPromiseFinishAllItems(TEMP_LAUNCH_ID)
                    .then(done);
            });

            jasmine.clock().tick(300001);
            jasmine.clock().uninstall();
        });

        it('resolves promise imediatelly if there are no scheduled requests', (done) => {
            client.getPromiseFinishAllItems(TEMP_LAUNCH_ID).then((result) => {
                expect(result).toBeTruthy();
                done();
            });
        });


        it('resolves promise after wait if there are scheduled requests', (done) => {
            const scope = nock(config.endpoint)
                .get('/user')
                .times(3)
                .delay(50)
                .reply(200, userResponseData);

            client.checkConnect().then(noop);
            client.checkConnect().then(noop);
            client.checkConnect().then(noop);

            expect(client.queue.ongoingCount).toEqual(1);
            expect(client.queue.waitingCount).toEqual(2);

            client.getPromiseFinishAllItems(TEMP_LAUNCH_ID).then((result) => {
                expect(result).toBeTruthy();
                expect(client.queue.ongoingCount).toEqual(0);
                expect(client.queue.waitingCount).toEqual(0);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    describe('#startTestItem', () => {
        it('returns object with promise and tempId', (done) => {
            const testItemObject = client.startTestItem({}, TEMP_LAUNCH_ID, TEMP_SUITE_ID);

            // todo check that old tempId is returned
            expect(typeof testItemObject.tempId === 'string').toBeTruthy();
            expect(testItemObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(testItemObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(testItemObject.promise, done);
        });

        it('resolves promise in case of STEP with new realId', (done) => {
            const stepData = copy({}, STEP_DATA);

            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/item/${REAL_SUITE_ID}`)
                .reply(201, { id: REAL_STEP_ID });

            client.startTestItem(stepData, TEMP_LAUNCH_ID, TEMP_SUITE_ID).promise.then((result) => {
                expect(result).toEqual({ id: REAL_STEP_ID });
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('resolves promise in case of SUITE with new realId', (done) => {
            const suiteData = copy({}, SUITE_DATA);

            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/item`)
                .reply(201, { id: REAL_SUITE_ID });

            client.startTestItem(suiteData, TEMP_LAUNCH_ID).promise.then((result) => {
                expect(result).toEqual({ id: REAL_SUITE_ID });
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('rejects with error if launch was not found by tempId', (done) => {
            const stepData = copy(STEP_DATA);

            client.startTestItem(stepData, UNEXISTENT_TEMP_LAUNCH_ID, TEMP_SUITE_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Launch "${UNEXISTENT_TEMP_LAUNCH_ID}" not found`);
                done();
            });
        });

        it('rejects promise with error if launch is finished', (done) => {
            client.tree.getItem(TEMP_LAUNCH_ID).finishSend = true;

            const stepData = copy({}, STEP_DATA);

            client.startTestItem(stepData, TEMP_LAUNCH_ID, TEMP_SUITE_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Launch "${
                    TEMP_LAUNCH_ID}" is already finished, you can not add an item to it`);
                done();
            });
        });

        it('rejects promise with error if parentItemId is not found', (done) => {
            const stepData = copy({}, STEP_DATA);

            client.startTestItem(stepData, TEMP_LAUNCH_ID, UNEXISTENT_TEMP_SUITE_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Item "${UNEXISTENT_TEMP_SUITE_ID}" not found`);
                done();
            });
        });

        it('rejects promise with error in case of API error', (done) => {
            const suiteData = copy({}, SUITE_DATA);

            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/item`)
                .reply(403, unathorizedErrorResponseMessage);

            client.startTestItem(suiteData, TEMP_LAUNCH_ID).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    xdescribe('#finishTestItem', () => {
        it('returns object with promise and tempId', (done) => {
            const testItemObject = client.finishTestItem(TEMP_SUITE_ID, {});

            // todo check that old tempId is returned
            expect(typeof testItemObject.tempId === 'string').toBeTruthy();
            expect(testItemObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(testItemObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(testItemObject.promise, done);
        });

        it('resolves promise in case of SUITE with correct response message', (done) => {
            const suiteData = copy({}, SUITE_DATA);

            const scope = nock(config.endpoint)
                .put(`/${TEST_PROJECT}/item/${REAL_SUITE_ID}`)
                .reply(200, realItemFinishedResponseMessage);

            client.finishTestItem(TEMP_SUITE_ID, suiteData).promise.then((result) => {
                expect(result).toEqual(realItemFinishedResponseMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('rejects promise with error if itemId is not found', (done) => {
            const suiteData = copy({}, SUITE_DATA);

            client.finishTestItem(UNEXISTENT_TEMP_SUITE_ID, suiteData).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Item "${UNEXISTENT_TEMP_SUITE_ID}" not found`);
                done();
            });
        });

        it('rejects promise with error in case of API error', (done) => {
            const suiteData = copy({}, SUITE_DATA);

            const scope = nock(config.endpoint)
                .put(`/${TEST_PROJECT}/item/${REAL_SUITE_ID}`)
                .reply(403, unathorizedErrorResponseMessage);

            client.finishTestItem(TEMP_SUITE_ID, suiteData).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    xdescribe('#saveLog', () => {
        it('returns object with promise and tempId', (done) => {
            const logItemObject = client.saveLog(TEMP_STEP_ID, () => Promise.resolve());
            // todo check that old tempId is returned
            expect(typeof logItemObject.tempId === 'string').toBeTruthy();
            expect(logItemObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(logItemObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(logItemObject.promise, done);
        });

        it('resolves promise with correct response from promise function', (done) => {
            const promiseFunction = () => Promise.resolve(true);

            client.saveLog(TEMP_STEP_ID, promiseFunction).promise.then((result) => {
                expect(result).toBeTruthy();
                done();
            });
        });

        it('ignores promise with error from promise function', (done) => {
            const promiseFunction = () => Promise.reject(new Error('REJECTED!'));

            client.saveLog(TEMP_STEP_ID, promiseFunction).promise.then((result) => {
                expect(result).toBeUndefined();
                done();
            });
        });

        it('rejects promise with error if itemId not found', (done) => {
            const promiseFunction = () => Promise.resolve(true);

            client.saveLog(UNEXISTENT_TEMP_STEP_ID, promiseFunction).promise.catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(`Item "${UNEXISTENT_TEMP_STEP_ID}" not found`);

                done();
            });
        });
    });

    xdescribe('#sendLog', () => {
        it('calls #sendLogWithoutFile', () => {
            spyOn(client, 'sendLogWithoutFile');

            client.sendLog(
                TEMP_STEP_ID,
                LOG_MESSAGE,
            );

            expect(client.sendLogWithoutFile)
                .toHaveBeenCalledWith(TEMP_STEP_ID, LOG_MESSAGE);
        });

        it('calls #sendLogWithFile', () => {
            spyOn(client, 'sendLogWithFile');

            client.sendLog(
                TEMP_STEP_ID,
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            );

            expect(client.sendLogWithFile)
                .toHaveBeenCalledWith(TEMP_STEP_ID, LOG_MESSAGE, LOG_ATTACHMENT);
        });
    });

    xdescribe('#sendLogWithoutFile', () => {
        it('returns object with promise and tempId', (done) => {
            const logItemObject = client.sendLogWithoutFile(
                TEMP_STEP_ID,
                LOG_MESSAGE,
            );
            // todo check that old tempId is returned
            expect(typeof logItemObject.tempId === 'string').toBeTruthy();
            expect(logItemObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(logItemObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(logItemObject.promise, done);
        });

        it('resolves promise with correct response', (done) => {
            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/log`)
                .reply(201, { id: REAL_LOG_ID });

            client.sendLogWithoutFile(
                TEMP_STEP_ID,
                LOG_MESSAGE,
            ).promise.then((result) => {
                expect(result).toEqual({ id: REAL_LOG_ID });
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('ignores promise rejection with error from API', (done) => {
            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/log`)
                .reply(403, unathorizedErrorResponseMessage);

            client.sendLogWithoutFile(
                TEMP_STEP_ID,
                LOG_MESSAGE,
            ).promise.then((result) => {
                expect(result).toBeUndefined();
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    xdescribe('#sendLogWithFile', () => {
        it('returns object with promise and tempId', (done) => {
            const logItemObject = client.sendLogWithFile(
                TEMP_STEP_ID,
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            );
            // todo check that old tempId is returned
            expect(typeof logItemObject.tempId === 'string').toBeTruthy();
            expect(logItemObject.tempId.length).toBeGreaterThanOrEqual(canonicalLengthOfTempUniqueId);
            expect(logItemObject.promise instanceof Promise).toBeTruthy();

            swallowPromise(logItemObject.promise, done);
        });

        it('resolves promise with correct response', (done) => {
            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/log`)
                .reply(201, { id: REAL_LOG_ID });

            client.sendLogWithFile(
                TEMP_STEP_ID,
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            ).promise.then((result) => {
                expect(result).toEqual({ id: REAL_LOG_ID });
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('ignores promise rejection with error from API', (done) => {
            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/log`)
                .reply(403, unathorizedErrorResponseMessage);

            client.sendLogWithFile(
                TEMP_STEP_ID,
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            ).promise.then((result) => {
                expect(result).toBeUndefined();
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    xdescribe('#getRequestLogWithFile', () => {
        it('returns promise', (done) => {
            const promise = client.getRequestLogWithFile(
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            );

            swallowPromise(promise, done);
        });

        xit('uses buildMultiPartStream with correct data', (done) => {
            spyOn(client, 'buildMultiPartStream');

            const promise = client.getRequestLogWithFile(
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            );

            swallowPromise(promise.then(() => {
                expect(client.buildMultiPartStream).toHaveBeenCalledWith(
                    LOG_MESSAGE,
                    LOG_ATTACHMENT,
                );
                done();
            }));
        });

        it('resolves promise with correct response data', (done) => {
            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/log`)
                .reply(201, { id: REAL_LOG_ID });

            client.getRequestLogWithFile(
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            ).then((result) => {
                expect(result).toEqual({ id: REAL_LOG_ID });
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });

        it('ignores promise rejection', (done) => {
            const scope = nock(config.endpoint)
                .post(`/${TEST_PROJECT}/log`)
                .reply(403, unathorizedErrorResponseMessage);

            client.getRequestLogWithFile(
                LOG_MESSAGE,
                LOG_ATTACHMENT,
            ).then((result) => {
                expect(result).toBeUndefined();
                expect(scope.isDone()).toBeTruthy();
                done();
            });
        });
    });

    xdescribe('#buildMultiPartStream', () => {
        // add check for authorization header in requests...
        it('returns new Buffer for composed stream json + file', () => {
            const buffer = client.buildMultiPartStream(
                LOG_MESSAGE,
                LOG_ATTACHMENT,
                '--delimeter--',
            );

            expect(buffer).toBeDefined();
            expect(buffer instanceof Buffer).toBeTruthy();
        });
    });

    xdescribe('OPTIONS', () => {
        // todo
    });

    xdescribe('concurrency', () => {

    });
});
