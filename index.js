var fastn = require('fastn')({
    _generic: require('fastn/genericComponent'),
    text: require('fastn/textComponent'),
    timePicker: require('./timePicker')
});

module.exports = function(settings) {
    return fastn('timePicker', settings).attach().render();
};
