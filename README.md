# timepicker-component
A standalone time picker component built with `fastn.js`

# Usage

## Standalone
```javascript
var createTimepicker = require('timepicker-component');

var timePicker = createTimepicker();

timePicker.time.on('change', function(time) {
    // time is a string set to 12 hour format.
})

```
