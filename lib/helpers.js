const RestClient = require('./rest');

const MIN = 3;
const MAX = 256;

const sleep = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const waitForCondition = (condition, timeout = 100, attempt = 20) => {
    return sleep(timeout)
        .then(() => {
            if (attempt < 0) {
                throw new Error('Failed to wait for condition to be fullfiled');
            }

            const result = condition();
            // console.log('check condition:', result);
            if (!result) {
                return waitForCondition(condition, timeout, attempt - 1);
            }

            return false;
        });
};

const now = () => new Date().valueOf();

const getServerResult = (url, request, options, method) => RestClient
    .request(method, url, request, options);

const formatName = (name) => {
    const len = name.length;
    return (
        (len < MIN)
            ? (name + new Array((MIN - len) + 1).join('.'))
            : name
    ).slice(-MAX);
};

module.exports = {
    formatName,
    now,
    getServerResult,
    sleep,
    waitForCondition,
};
