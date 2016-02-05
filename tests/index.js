var test = require('tape');

var timePicker = require('./')();

test('timePicker exists', function(t){
    t.plan(1);

    t.ok(timePicker);
});
