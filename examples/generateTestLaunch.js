const fs = require('fs');
const uniqid = require('uniqid');
const config = require('./client.conf');
const RPClient = require('../lib/report-portal-client.js');

const screenshot = fs.readFileSync('./screenshot.b64', { encoding: 'utf-8' });

const rpClient = new RPClient(config);

const tempSuiteIds = [];
const tempStepIds = [];

// Finalization of test launch should be in reverse order.
// You can't mark items as FINISHED if there are any childs under certain item with status IN PROGRESS.
// You should first of all mark all TEST items as FINISHED, then SUITE.
// Otherwise you will get 406 error from API and your launch will stuck with status IN PROGRESS,
// make sure that you manage order of your actions.

// You can avoid usage of promises chain, just set concurrency for 1 in config,
// but you will send results slower, if you want to send results faster you can set
// concurrency to higher value, but in this case you will need to store promises to resolve
// them in appropriate way.

const startTime = Date.now().valueOf();

const launchObj = rpClient.startLaunch({
    name: 'Client test',
    start_time: rpClient.helpers.now(),
    description: 'DESCRIPTION',
    tags: ['your', 'tags'],
});

// launchObj;

Promise.resolve()
    // launchObj.promise
    // update existing launch with new info
    .then(() => {
        rpClient.updateLaunch(launchObj.tempId, {
            description: 'test description',
            tags: ['test', 'tag'],
        });
        // we are waiting till all are actions completed
        // return rpClient.getPromiseFinishAllItems(launchObj.tempId);
    })
    // add suites to existing launch
    .then(() => {
        for (let i = 0; i < 1; i += 1) {
            const suiteObj = rpClient.startTestItem(
                {
                    description: uniqid(),
                    name: uniqid(),
                    start_time: rpClient.helpers.now(),
                    type: 'SUITE',
                },
                launchObj.tempId,
            );
            tempSuiteIds.push(suiteObj.tempId);
        }
        // return rpClient.getPromiseFinishAllItems(launchObj.tempId);
    })
    // add steps to suites
    .then(() => {
        tempSuiteIds.forEach((tempSuiteId) => {
            for (let i = 0; i < 2; i += 1) {
                const stepObj = rpClient.startTestItem(
                    {
                        description: uniqid(),
                        name: uniqid(),
                        start_time: rpClient.helpers.now(),
                        type: 'STEP',
                    },
                    launchObj.tempId,
                    tempSuiteId,
                );
                tempStepIds.push(stepObj.tempId);
            }
        });
        // return rpClient.getPromiseFinishAllItems(launchObj.tempId);
    })
    // add logs and attachments to the steps
    .then(() => {
        tempStepIds.forEach((tempStepId) => {
            for (let i = 0; i < 1; i += 1) {
                // rpClient.sendLog(
                //     tempStepId,
                //     {
                //         level: 'INFO',
                //         message: uniqid(),
                //         time: rpClient.helpers.now(),
                //     },
                // );
                // rpClient.sendLogWithFile(
                //     tempStepId,
                //     {
                //         level: 'INFO',
                //         message: uniqid(),
                //         time: rpClient.helpers.now(),
                //     },
                //     {
                //         name: uniqid(),
                //         type: 'image/png',
                //         content: screenshot,
                //     },
                // );
            }
        });
        // return rpClient.getPromiseFinishAllItems(launchObj.tempId);
    })
    // mark as failed all steps
    .then(() => {
        tempStepIds.map(tempStepId =>
            rpClient.finishTestItem(
                tempStepId,
                {
                    end_time: rpClient.helpers.now(),
                    status: 'failed',
                },
            ).promise);
    })
    // // mark as passed all suites, only in that order
    .then(() => {
        tempSuiteIds.map(tempSuiteId => rpClient.finishTestItem(
            tempSuiteId,
            {
                end_time: rpClient.helpers.now(),
                status: 'passed',
            },
        ).promise);
    })
    // finish launch
    .then(() => rpClient.finishLaunch(
        launchObj.tempId,
        {
            end_time: rpClient.helpers.now(),
        },
    ).promise.then(() => {
        console.log('took', Date.now().valueOf() - startTime);
    }));
