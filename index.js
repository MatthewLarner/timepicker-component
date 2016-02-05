var fastn = require('fastn')({
    text: require('fastn/textComponent'),
    timePicker: require('./timePickerComponent')
});

module.exports = function(settings) {
    return fastn('timePicker', settings).attach().render();
};
