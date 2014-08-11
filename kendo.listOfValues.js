(function(f, define){
    define([], f);
})(function(){

    (function($) {
        var kendo = window.kendo = window.kendo || { cultures: {} };
        /** KENDO EXTENSION - Magic Lookup **/

        var DATABINDING = 'dataBinding',
            DATABOUND = 'dataBound',
            CHANGE = 'change',
            SELECT_INPUT = '[data-ml="input"]',
            SELECT_BUTTON = '[data-ml="button"]',
            SELECT_BUTTON_OPEN = '[data-action="open"]',
            SELECT_BUTTON_CLOSE = '[data-action="close"]',
            SELECT_BUTTON_FILTER = '[data-action="filter"]',
            SELECT_BUTTON_RESET = '[data-action="reset"]',
            SELECT_BUTTON_OK = '[data-action="choose"]',
            SELECT_FIELDS = '[data-ml="fields"]',
            INVALID_DS_MSG = 'Invalid data source provided. Must contain a valid Schema.',
            FOCUSED = "k-state-focused",
            DISABLED = "k-state-disabled",
            HOVER = "k-state-hover",
            ns = '.lookup';

        var Lookup = kendo.ui.Widget.extend({
            init: function(element, options) {
                var self = this,
                    pickerWrap;

                // Base initialization
                kendo.ui.Widget.fn.init.call(this, element, options);

                element = self.element;
                options = self.options;

                options.placeholder = options.placeholder || element.attr("placeholder");
                if (kendo.support.placeholder) {
                    element.attr("placeholder", options.placeholder);
                }

                pickerWrap = element.wrap('<div data-ml="wrapper" class="' + options.innerWrapClass + '" />').parent();
                self.wrapper = pickerWrap.wrap('<div class="' + options.outerWrapClass + '" />');

                element.addClass("k-input");
                element.attr('data-ml', 'input');

                self._oldVal = options.value;
                this._selected = null;

                self.button = $('<span />')
                    .attr('class', 'k-select')
                    .attr('data-ml', 'button')
                    .attr('data-action', 'open')
                    .html('<span class="k-icon k-i-search"></span>');
                self.wrapper.append(self.button);

                self._initWindow();

                self._initDataSource();

                self._initEvents();

                self.refresh();
            },

            _initWindow: function() {
                var self = this,
                    wdw,
                    wrapper,
                    filterPanel,
                    filterButtons,
                    resizeProxy = $.proxy(self._resizeGrid, self);

                wdw = $('<div />')
                    .kendoWindow({
                         actions: ['Close'],
                         title: self.options.windowTitle,
                         modal:true,
                         width: self.options.windowWidth,
                         height: self.options.windowHeight,
                         resize: resizeProxy,
                         activate: function() {
                            if (self.dataSource.total() == 0) {
                                // If no results from the search, focus the first field.
                                var input = $(this.element).find(SELECT_FIELDS).find('input:eq(0)');
                                if (self.options.enableFocus)
                                    input.focus();
                            } else {
                                // If there were results, focus the table.
                                self._grid.select(null);
                                if (self.options.enableFocus)
                                    self._grid.table.focus();
                            }
                             self._resizeGrid();
                         },
                         deactivate: function() {
                            if (self.options.enableFocus)
                                setTimeout(function() { self.wrapper.find(SELECT_BUTTON_OPEN).focus(); }, 0);
                         }
                    });
                self.window = wdw.data('kendoWindow');

                filterButtons = $('<div class="vm-detail-fields" />')
                    .append($('<div class="vm-detail-field">')
                        .append('<label />')
                        .append($('<div class="vm-detail-field-value">')
                            .append('<button class="k-button" data-ml="button" data-action="filter">Filter</button> ')
                            .append('<button class="k-button" data-ml="button" data-action="reset">Reset</button>')
                        )
                    );

                filterPanel = $('<div class="vm-lu-filter-panel" />')
                    .append($('<div data-ml="fields" class="vm-detail-fields">' + INVALID_DS_MSG + '<div>')
                        .kendoValidator({
                            rules: {
                                requiredFields: $.proxy(self._validateFields, self)
                            },
                            messages: {
                                requiredFields: $.proxy(self._validateFieldsMessage, self)
                            },
                            validateOnBlur: false
                        })
                    )
                    .append(filterButtons);

                wrapper = $('<div style="height: 100%; overflow: hidden;"/>')
                    .append(filterPanel)
                    .appendTo(wdw);

                self._grid = $('<div />').appendTo(wrapper)
                    .kendoGrid({
                        autoBind: false,
                        columns: self.options.gridColumns,
                        filterable: false,
                        sortable: true,
                        selectable: 'row',
                        navigatable: true,
                        scrollable: { virtual: true },
                        change: $.proxy(self._gridChange, self)
                    })
                    .data('kendoGrid');

                $('<div class="vm-lu-commands" />')
                    .append('<button class="k-button" data-ml="button" data-action="choose">Use Selection</button>')
                    .append('<button class="k-button" data-ml="button" data-action="close">Cancel</button>')
                    .appendTo(wrapper);
            },

            _initEvents: function() {

                var self = this,
                    $elem = $(self._getInput());

                if ($elem.length !== 1)
                    return;

                self.wrapper
                    .on("focus" + ns, SELECT_INPUT, function () {
                        $elem.addClass(FOCUSED);
                    })
                    .on("blur" + ns, SELECT_INPUT, function () {
                        self._inputChange();
                        $elem.removeClass(FOCUSED);
                    })
                    .on("mouseover" + ns, function() {
                        $(this).addClass(HOVER);
                    })
                    .on("mouseout" + ns, function() {
                        $(this).removeClass(HOVER);
                    })
                    .on("click" + ns, SELECT_BUTTON, function(evt) {
                        self.open();
                        evt.preventDefault();
                    });
                self.window.element
                    .on("click" + ns, SELECT_BUTTON, function(evt) {
                        var btn = $(this);

                        if (btn.is(DISABLED)) {
                            evt.preventDefault();
                            return;
                        }

                        if (btn.is(SELECT_BUTTON_FILTER))
                            self.filter();
                        else if (btn.is(SELECT_BUTTON_RESET))
                            self.reset();
                        else if (btn.is(SELECT_BUTTON_OK))
                            self.choose();
                        else if (btn.is(SELECT_BUTTON_CLOSE))
                            self.close();
                        else
                            return;

                        evt.preventDefault();
                    })
                    .on("keydown" + ns, '.k-grid', function(evt) {
                        if (evt.keyCode === kendo.keys.ENTER) {
                            var grid = self._grid,
                                td = grid.element.find('td.k-state-focused');
                                isSelected = td.parent().is('.k-state-focused');

                            if (!isSelected)
                                grid.select(td.parent());

                            self.choose();
                        } else if (evt.keyCode === kendo.keys.ESC) {
                            self.close();
                        }
                    })
                    .on('dblclick' + ns, '.k-grid td[role="gridcell"]', function(evt) {
                        self.choose();
                    })
                    .on('keydown' + ns, SELECT_FIELDS, function(evt) {
                        if (evt.keyCode === kendo.keys.ENTER) {
                            $(evt.target).trigger(CHANGE);
                            self.filter();
                            evt.preventDefault();
                        }
                    });
            },

            _initDataSource: function() {
                var self = this;

                // Raise any previously registered callbacks
                self._raiseFilterCallbacks('Data source re-initialized');

                if (self.dataSource && self._refreshHandler) {
                    self.dataSource.unbind(CHANGE, self._refreshHandler);
                } else {
                    self._refreshHandler = $.proxy(self._dataSourceChanged, self);
                }

                self.dataSource = kendo.data.DataSource.create(self.options.dataSource);
                self.dataSource.bind(CHANGE, self._refreshHandler);

                self._grid.setDataSource(self.dataSource);

                self._initColumns();
                self._initFields();

                if (self.options.autoBind) {
                    self.dataSource.fetch();
                }
            },

            _raiseFilterCallbacks: function(err) {
                var idx,
                    callback,
                    self = this;

                if (self._pendingCallbacks) {
                    for (idx = 0; idx < self._pendingCallbacks.length; idx++) {
                        callback = self._pendingCallbacks[idx]
                        callback(err);
                    }
                }
                self._pendingCallbacks = [];
            },

            _initColumns: function() {
                var self = this
                    schema = self.dataSource.options.schema;

                if (self.options.fieldColumns.length)
                    self._fieldColumns = self.options.fieldColumns;
                else
                    self._fieldColumns = [];

                self._filterDefaultValues();
            },

            _initFields: function() {
                var self = this,
                    $container = self.window.element.find(SELECT_FIELDS),
                    fields,
                    column;

                if (!self._fieldColumns.length) {
                    $container.html(INVALID_DS_MSG);
                    return;
                }

                $container.html('');

                var attrByName = {};
                if (self.options.meta.listAttrs) {
                    $.each(self.options.meta.listAttrs, function(a) {
                        attrByName[this.name] = this;
                    });
                }

                // Which fields are required? Used by the validators.
                self._requiredFields = {};
                self._selectiveFields = {};
                if (self.options.meta.listAttrs) {
                    $.each(self.options.meta.listAttrs, function(a) {
                        if (this.required == 'Required')
                            self._requiredFields[this.name] = this;
                        else if (this.required == 'SelectivelyRequired')
                            self._selectiveFields[this.name] = this;
                    });
                }

                // Create the fields HTML
                for (var field in self._fieldColumns) {
                    column = self._fieldColumns[field];

                    if (typeof(self.filterValues.get(column.field)) === 'undefined')
                        self.filterValues.set(column.field, '');

                    var fieldMeta = attrByName[column.field] || {};

                    fieldMeta = $.extend({
                        tooltip: '',
                        label: column.field,
                        required: '',
                        field: column.field,
                        format: null,
                        editor: null
                    }, fieldMeta, column);

                    var requiredIndicator = '';
                    if (fieldMeta.required === 'Required')
                        requiredIndicator = '<span class="vm-detail-field-required">*</span>';
                    else if (fieldMeta.required === 'SelectivelyRequired')
                        requiredIndicator = '<span class="vm-detail-field-selectiverequired">**</span>';

                    $container.append(
                        $('<div class="vm-detail-field vm-detail-field-new-row vm-detail-field-wide-block" />')
                            .append($('<label />')
                                .html(fieldMeta.label)
                                .attr('title', fieldMeta.tooltip)
                                .prepend(requiredIndicator)
                            )
                            .append(' ')
                            .append($('<span class="vm-detail-field-value">')
                                .append($('<div />')
                                    .kendoEditable({
                                        fields: {
                                            field: fieldMeta.field,
                                            format: fieldMeta.format,
                                            editor: fieldMeta.editor
                                        },
                                        model: self.filterValues,
                                        change: $.proxy(self._validate, self)
                                    })
                                )
                            )
                    );
                }
            },

            _validate: function() {
                var validator = this.window.element
                    .find(SELECT_FIELDS)
                    .data('kendoValidator');

                return validator.validate();
            },

            _validateFields: function(input) {
                var self = this,
                    fieldName = input[0].name,
                    otherFields,
                    otherField;

                if ($.trim((input.val() || '')).length == 0) {
                    if (self._requiredFields[fieldName])
                        return false;

                    if (self._selectiveFields[fieldName]) {
                        otherFields = self.window.element.find(SELECT_FIELDS).find('input[name]');
                        for (var key in self._selectiveFields) {
                            otherField = otherFields.filter('[name="' + key + '"]');
                            if ($.trim((otherField.val() || '')).length != 0)
                                return true;
                        }

                        return false;
                    }
                }
                return true;
            },

            _validateFieldsMessage: function(input) {
                var self = this,
                    fieldName = input[0].name,
                    msg = null;

                if (self._requiredFields[fieldName])
                    msg = 'Mandatory field.';
                else if (self._selectiveFields[fieldName]) {
                    var visibleFieldsElems = self.window.element.find(SELECT_FIELDS).find('input[name]');

                    var visibleFields = [];
                    visibleFieldsElems.each(function() {
                        if (self._selectiveFields[this.name])
                            visibleFields.push(this.name);
                    })
                    msg = 'At least one of: ' +
                        $.map(visibleFields, function(name) {
                                var item = self._selectiveFields[name]
                                // TODO: Take into account the options.columns...
                                return item.label || item.name || name;
                            }
                        ).join(', ') +
                        ' is required.';
                }

                return msg;
            },

            _getInput: function() {
                return this.element[0];
            },

            _filterDefaultValues: function() {
                var self = this;

                if (typeof(self.filterValues) === 'undefined')
                    self.filterValues = kendo.observable(self.options.filterValues);
                else {
                    self.filterValues.forEach(function(obj, key) {
                        if (typeof (self.options.filterValues[key]) != 'undefined')
                            self.filterValues.set(key, self.options.filterValues[key]);
                        else
                            self.filterValues.set(key, null);
                    })
                }
            },

            _resizeGrid: function() {
                var grid = this._grid.element,
                    dataArea = grid.find('.k-grid-content'),
                    wrapper = this.window.element.children().first(),
                    newHeight = wrapper.outerHeight() - 2,
                    contentHeight = 0;

                wrapper.children().not('.k-grid').each(function() { console.log('  -= ' + $(this).outerHeight(true)); newHeight -= $(this).outerHeight(true); });
                grid.children().not('.k-grid-content').each(function() { contentHeight += $(this).height(); });

                console.log('wrapper.outerHeight: ' + wrapper.outerHeight());
                console.log('grid.height: ' + newHeight);
                console.log('dataArea.height: '+(newHeight - contentHeight));

                grid.height(newHeight);
                dataArea.height(newHeight - contentHeight);
            },

            setDataSource: function(dataSource) {
                this.options.dataSource = dataSource;
                this._initDataSource();
            },

            open: function() {

                self._inputChanged = false;

                this.reset();
                this.refresh();

                if (!this.window.element.is(':visible'))
                    this.window.center().open();

                return this;
            },

            close: function() {
                this.window.close();

                return this;
            },

            filter: function(callback) {
                var self = this,
                    ds = self.dataSource,
                    qry = {
                        filter: [],
                        sort: ds.sort(),
                        group: ds.group(),
                        page: ds.page(),
                        pageSize: ds.pageSize(),
                        aggregate: ds.aggregate()},
                    validator = self.window.element.find(SELECT_FIELDS).data('kendoValidator');

                if (self._validate()) {
                    self.filterValues.forEach(function(obj, key) {
                        if (obj) {
                            qry.filter.push({ field: key, operator: 'contains', value: obj });
                        }
                    });

                    if (callback)
                        self._pendingCallbacks.push(callback);
                    ds.query(qry);
                }
            },

            filterFromInput: function(callback) {
                var self = this,
                    value = self._getInput().value;

                self.filterValues.set(self.options.valueField, value);

                if (value.length) {
                    self._inputChanged = true;
                    self.filter(callback);
                } else {
                    if (callback)
                        callback();
                }

            },

            reset: function() {
                var self = this,
                    value = self.wrapper.find(SELECT_INPUT).val(),
                    validator = self.window.element
                        .find(SELECT_FIELDS)
                        .data('kendoValidator');

                self._filterDefaultValues();

                if (value)
                    self.filterValues.set(self.options.valueField, value);

                if (validator) {
                    validator.hideMessages();
                    self.window.element.find(SELECT_FIELDS).find('input.k-invalid').removeClass('k-invalid');
                }
            },

            choose: function() {
                var self = this;

                self._oldVal = self.value();
                self.wrapper.find(SELECT_INPUT)
                    .val(self._oldVal)
                    .trigger(CHANGE);

                self.trigger(CHANGE);

                self.close();
            },

            destroy: function() {
                var that = this;

                that.popup.destroy();

                that.element.off(ns);
                that.wrapper.off(ns);
                that.window.off(ns);

                Widget.fn.destroy.call(that);
            },

            refresh: function() {
                var self = this,
                    $elem = $(self.element);

                // Manipulate the DOM between the two events
                self.trigger(DATABINDING);

                if (true === self.options.showInput) {
                    $elem.show();
                } else {
                    $elem.hide();
                }

                if (!isNaN(parseInt(self.options.autoFocusTimeout))) {
                    setTimeout(function() { self.wrapper.find('button').focus(); }, parseInt(self.options.autoFocusTimeout));
                    self.options.autoFocusTimeout = null;
                }

                self._refreshCommands();

                self.trigger(DATABOUND);
            },

            _refreshCommands: function() {
                var self = this,
                    btn = self.window.element.find(SELECT_BUTTON_OK);

                if (self.selected())
                    btn.removeClass(DISABLED);
                else
                    btn.addClass(DISABLED);
            },

            _dataSourceChanged: function(ds) {
                var self = this;

                if (!ds.items) {
                    self._selected = null;
                    return self._raiseFilterCallbacks('No items in datasource change event callback.');
                }

                if (self.window.element.is(':visible')) {
                    if (ds.items.length && self.options.enableFocus)
                        self._grid.table.focus();
                } else {
                    if (self._inputChanged) {
                        if (ds.items.length !== 1) {
                            // TODO: We might want to just make it appear invalid, not open the window.
                            self._selected = null;
                            if (self.options.openOnInvalid)
                                self.open();

                            return self._raiseFilterCallbacks(ds.items.length + ' matching rows found.');
                        } else {
                            self._selected = ds.items[0];
                            self.choose();

                            return self._raiseFilterCallbacks();
                        }
                    }
                }

                this.refresh();
                this._resizeGrid();

                return self._raiseFilterCallbacks();
            },

            value: function (value) {
                var self = this,
                    dataItem;

                if (value !== undefined) {
                    self._oldVal = value || '';
                    self.wrapper.find(SELECT_INPUT).val(value);
                } else {
                    dataItem = self._accessor();
                    return (dataItem) ? dataItem[self.options.valueField] : null;
                }
            },

            lovMeta: function(meta) {
                this.options.meta = meta;
                this._initDataSource();
            },

            selected: function() {
                return this._accessor();
            },

            _inputChange: function() {
                var self = this,
                    value = self.wrapper.find(SELECT_INPUT).val() || '';

                if (value !== self._oldVal) {
                    self.filterFromInput();

                    self._oldVal = value || '';
                }
            },

            _gridChange: function() {
                var self = this,
                    grid = self._grid,
                    selected = grid.select();

                if (selected.length) {
                    self._selected = grid.dataItem(selected[0]);
                } else {
                    self._selected = null;
                }

                self._refreshCommands();
            },

            _accessor: function (value) {
                if (value !== undefined) {
                    throw new Error("Can't set accessor on LOV control");
                } else {
                    return this._selected;
                }
            },

            options: {
                name: 'Lookup',
                placeholder: '',
                openOnInvalid: false,
                showInput: true,
                windowTitle: 'Search and Select',
                windowWidth: 600,
                windowHeight: 450,
                outerWrapClass: 'k-widget vm-lookup',
                innerWrapClass: 'k-picker-wrap k-state-default',
                autoBind: false,
                valuePrimitive: false,
                valueField: null,
                value: null,
                enableFocus: false, // Enable focusing input box and table after results are found. Causes problems when the page height exceeds browser clientHeight.

                // Which fields are visible
                fieldColumns: [],

                // Which fields are displayed in the grid
                gridColumns: [],

                // Current values of the filters
                filterValues: {},
                meta: {
                    // Not used currently.
                    "name": '',

                    // Not used currently.
                    "attrNames": null,

                    // Not used currently.
                    "derivedAttrNames": null,

                    /* Used by fieldColumns, describes all columns of result data. Array of 'AttrDef'
                    {
                        name: string     (entity name)
                        label: string    (human readable display name)
                        tooltip: string  (help text)
                        required: string ('SelectivelyRequired', 'Required', 'Optional')
                        defaultOperator  (any kendoui datasource operator)
                        format: string   (kendoui validation format)
                        editor: string   (advanced: kendoui editor type)
                    }
                    */
                    "listAttrs": null,

                    // Not used currently.
                    "listDisplayAttrNames": null,
                    "displayCriteria": null,
                    "multiOperators": false,
                    "autoExecute": false
                },

                autoFocusTimeout: 1000
            },

            events: [
                DATABINDING,
                DATABOUND
            ],

            items: function() {
                return this.element.children();
            }
        });
        kendo.ui.plugin(Lookup);

        kendo.data.binders.widget.lovMeta = kendo.data.Binder.extend({
            "refresh": function() {
                value = this.bindings["lovMeta"].get();
                if (this.element.lovMeta)
                    this.element.lovMeta(value);
            }
        });

    })(window.kendo.jQuery);

    return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });