(function(f, define){
    define([], f);
})(function(){

    (function($) {
        var kendo = window.kendo = window.kendo || { cultures: {} };

        /** KENDO EXTENSION - Magic Lookup **/

        var DATABINDING = 'dataBinding',
            DATABOUND = 'dataBound',
            CHANGE = 'change',

            PAT_MRN_IDX = 0,
            // sir AUID Not Currently appearing in this film
            PAT_GNAME_IDX = 2,
            PAT_SNAME_IDX = 3,
            PAT_EP_START_IDX = 4,
            PAT_EP_FINISH_IDX = 5,

            /*PAT_MRN_IDX = 'mrn',
            PAT_GNAME_IDX = 'otherNames',
            PAT_SNAME_IDX = 'surnam',
            PAT_EP_START_IDX = 'admitDatetime',
            PAT_EP_FINISH_IDX = 'dischargeDatetime',
            */
            SELECT_INPUT = '[data-ml="input"]',
            FOCUSED = "k-state-focused",
            ns = '.magicLookup';
        var MagicLookup = kendo.ui.Widget.extend({
            init: function(element, options) {
                var self = this;

                self.ns = ns;

                // Base initialization
                kendo.ui.Widget.fn.init.call(this, element, options);

                element = self.element;
                options = self.options;

                options.placeholder = options.placeholder || element.attr("placeholder");
                if (kendo.support.placeholder) {
                    element.attr("placeholder", options.placeholder);
                }

                self.wrapper = element.wrap('<div data-ml="wrapper" class="vm-magic-lookup" />').parent();
                element.attr('data-ml', 'input');
                element.addClass("k-input");

                self._initDataSource();

                self._initRowTemplate();
                self._initList();
                self._initPopup();
                self._initEvents();

                self._initStartDateTime();

                self._old = self._accessor();

                kendo.notify(self);
            },

            _initEvents: function() {

                var self = this,
                    $elem = $(self._getInput());

                if ($elem.length !== 1)
                    return;

                self.wrapper
                    .on('keyup' + ns, SELECT_INPUT, $.proxy(self._onKeyup, self))
                    .on('keydown' + ns, SELECT_INPUT, $.proxy(self._onKeydown, self))
                    .on("paste" + ns, SELECT_INPUT, $.proxy(self.search, self))
                    .on("focus" + ns, SELECT_INPUT, function () {
                        $elem.addClass(FOCUSED);
                    })
                    .on("blur" + ns, SELECT_INPUT, function () {
                        self._change();
                        $elem.removeClass(FOCUSED);
                    });
            },

            destroy: function() {
                var that = this;

                that.popup.destroy();

                that.element.off(ns);
                that.wrapper.off(ns);

                Widget.fn.destroy.call(that);
            },

            _getInput: function() {
                return this.element[0];
            },

            _onKeydown: function(evt) {
                var self = this,
                    listView = self.matchesList,
                    listViewDs,
                    keys = kendo.keys,
                    isEnter = evt.keyCode === keys.ENTER,
                    isTab = evt.keyCode === keys.TAB,
                    isArrow = (37 <= evt.keyCode && evt.keyCode <= 40),
                    selectedIdx;

                if (!self.popup.visible())
                    return;

                if (isEnter || isTab) {
                    listViewDs = listView.options.dataSource;
                    if (listViewDs.total() > 0) {
                        selectedIdx = Math.max(0, self._getSelectedRowIndex());
                        newVal = listViewDs.data()[selectedIdx].PatientIdLOV;
                        self._getInput().value = newVal;
                    }
                }

                if (isArrow) {
                    if (evt.keyCode === 38) {
                        // Up
                        self._moveSelectedRow(-1);
                    } else if (evt.keyCode === 40) {
                        // Down
                        self._moveSelectedRow(1);
                    }

                    self._lastSearch = self._getInput().value;
                    evt.preventDefault();
                    return;
                }

                if (isTab) {
                    self.hideFloats();
                }
            },

            _onKeyup: function(evt) {
                var self = this,
                    input = self._getInput(),
                    newVal = input.value,
                    keys = kendo.keys,
                    isEnter = evt.keyCode === keys.ENTER,
                    isEsc = evt.keyCode === keys.ESC;

                if (isEnter || isEsc) {
                    self.hideFloats();
                    input.setSelectionRange(newVal.length, newVal.length);

                    evt.preventDefault();

                    self._lastSearch = newVal;
                    return;
                }

                // The following test is a fix for cases of incredibly fast typing. Hit two number keys very quickly,
                // and by the time this event callback is hit the first time, 'newVal' will already have the value of both keys
                // in it. This means that we only need to handle the event once, even though it is fired twice. We detect this
                // by looking to see if the selection applied by the last event handle is still in effect.
                if (input.selectionEnd - input.selectionStart > 0)
                    return;

                self.search();
            },

            search: function() {
                var self = this,
                    input = self._getInput(),
                    newVal = input.value,
                    typed,
                    lastSearch = self._lastSearch || '',
                    matches;

                self._lastSearch = newVal;

                if (newVal.length == 0) {
                    self.hideFloats();
                    return;
                }

                if (lastSearch !== newVal) {
                    typed = newVal.length > lastSearch.length;

                    if (!isNaN(parseInt(newVal))) {
                        matches = self._searchByMRN(newVal);
                        if (matches.length > 0 && typed) {
                            var matchedValue = matches[0][PAT_MRN_IDX];
                            self._accessor(matchedValue);
                            self._getInput().setSelectionRange(newVal.length, matchedValue.length);
                        }
                    } else
                        matches = self._searchByName(newVal);

                    self._updateMatchesList(matches, typed);
                }
            },

            _searchByMRN: function(newVal) {
                var self = this,
                    row,
                    len = self._dsView.length,
                    matches = [];

                for (var idx = 0; idx < len; idx++) {

                    row = self._dsView[idx];

                    // Does the MRN match?
                    if (row[PAT_MRN_IDX].indexOf(newVal) === 0) {
                        // Within the period?
                        if (row[PAT_EP_START_IDX] <= self._startDateTime && (row[PAT_EP_FINISH_IDX] == null || self._startDateTime <= row[PAT_EP_FINISH_IDX])) {

                            // Intentionally allow pageSize + 1 entries, so we know to display the '...' at the bottom
                            // of the list.
                            matches.push(row);
                            if (matches.length > self.options.pageSize)
                                break;
                        }
                    }
                }

                return matches;
            },

            _searchByName: function(newVal) {
                var self = this,
                    row,
                    len = self._dsView.length,
                    matches = [],
                    regex = new RegExp(newVal + '.*', 'i');

                for (var idx = 0; idx < len; idx++) {

                    row = self._dsView[idx];

                    // Does the surname match?
                    if (regex.test(row[PAT_SNAME_IDX])) {
                        // Within the period?
                        if (row[PAT_EP_START_IDX] <= self._startDateTime && (row[PAT_EP_FINISH_IDX] == null || self._startDateTime <= row[PAT_EP_FINISH_IDX])) {

                            // Intentionally allow pageSize + 1 entries, so we know to display the '...' at the bottom
                            // of the list.
                            matches.push(row);
                            if (matches.length > self.options.pageSize)
                                break;
                        }
                    }
                }

                return matches;
            },

            _onMatchListViewChange: function(evt) {
                var self = this,
                    input,
                    matchesList,
                    listView = self.matchesList,
                    selectedIndex,
                    view,
                    mrn;

                selectedIndex = $(listView.select()[0]).index();
                view = listView.options.dataSource.view();
                if (selectedIndex !== null && selectedIndex >= 0 && view.length > selectedIndex) {
                    mrn = view[selectedIndex].PatientIdLOV;
                    input = self._getInput();
                    if (input.value !== mrn && !isNaN(parseInt(input.value))) {
                        $(input).val(mrn);
                        input.setSelectionRange(0, mrn.length);
                    }
                }
            },

            refresh: function() {
                var self = this

                self._lastSearch = '';
                self._dsView = this.dataSource.view();

                self._initStartDateTime();

                // Manipulate the DOM between the two events
                self.trigger(DATABINDING);

                if (!isNaN(parseInt(self.options.autoFocusTimeout)))
                    setTimeout(function() { self._getInput().focus(); }, parseInt(self.options.autoFocusTimeout));

                self.trigger(DATABOUND);
            },

            hideFloats: function() {
                var self = this;

                self.popup['close']();
                /*
                self.wrapper.find(SELECT_FLOATS).hide();

                if (!self._bodyFocusinHandler)
                    self._bodyFocusinHandler = $.proxy(self._onBodyFocusin, self);
                self.wrapper.off('focusin', self._bodyFocusinHandler);
                */
            },

            showFloats: function() {
                var self = this;

                self.popup['open']();
                /*
                self.wrapper.find(SELECT_FLOATS).show();

                if (!self._bodyFocusinHandler)
                    self._bodyFocusinHandler = $.proxy(self._onBodyFocusin, self);
                self.wrapper.on('focusin', self._bodyFocusinHandler);
            },

            _onBodyFocusin: function(evt) {
                if ($(evt.target).parents('[data-ml]').length === 0)
                    this.hideFloats();
                */
            },

            _updateMatchesList: function(matches, allowRowSelection) {
                var self = this,
                    newData = [],
                    oldData,
                    ds,
                    idx,
                    match;

                ds = self.matchesList.options.dataSource;

                if (!self.popup.visible())
                    self.showFloats();

                // Same list?
                oldData = ds.view();
                if (matches.length === oldData.length) {
                    for (idx = 0; idx < matches.length; idx++) {
                        if (matches[idx][PAT_MRN_IDX] !== oldData[idx].PatientIdLOV) {
                            oldData = null;
                            break;
                        }
                    }
                    if (oldData !== null) {
                        if (allowRowSelection) {
                            var selectedIdx = self._getSelectedRowIndex();
                            if (selectedIdx == -1)
                                self._moveSelectedRow(1);
                        }

                        // List is the same
                        return;
                    }
                }

                for (idx = 0; idx < matches.length; idx++) {
                    match = matches[idx];
                    newData.push({
                        PatientIdLOV: match[PAT_MRN_IDX],
                        PatientGivenName: match[PAT_GNAME_IDX],
                        PatientSurname: match[PAT_SNAME_IDX],
                        EpisodeStartDate: match[PAT_EP_START_IDX],
                        EpisodeFinishDate: match[PAT_EP_FINISH_IDX]
                    })
                }

                ds.data(newData);
                if (matches.length == 0) {
                    self.noMatches.show();
                    self.matchesList.element.hide();
                    self.matchesMore.hide();
                } else {
                    self.noMatches.hide();
                    self.matchesList.element.show();

                    if (ds.totalPages() > 1)
                        self.matchesMore.show();
                    else
                        self.matchesMore.hide();

                    if (allowRowSelection)
                        self._resetSelectedRow();
                }

                this.showFloats();
            },

            _moveSelectedRow: function(movement) {
                var listView = this.matchesList,
                    selectedItems,
                    currentIdx;

                selectedItems = listView.select();
                if (selectedItems.length === 0)
                    currentIdx = -1;
                else
                    currentIdx = $(selectedItems[0]).index();

                currentIdx = (currentIdx + movement + listView.element.children().length) % listView.element.children().length;
                listView.select(listView.element.children()[currentIdx]);

                // Make sure the popup is visible, then return.
                this.showFloats();
            },

            _getSelectedRowIndex: function() {
                var listView = this.matchesList,
                    selectedItems;

                selectedItems = listView.select();
                if (selectedItems.length === 0)
                    return -1;
                return $(selectedItems[0]).index();
            },

            _resetSelectedRow: function() {
                var listView = this.matchesList,
                    children;

                children = $(listView.element).children();
                if (children.length > 0) {
                    listView.select(children[0]);
                }

            },

            value: function (value) {
                if (value !== undefined) {
                    this._accessor(value);
                    this._old = value;
                    this._lastSearch = '';
                } else {
                    return this._accessor();
                }
            },

            _change: function() {
                var self = this,
                    value = self._accessor();

                if (value !== self._old) {
                    self._old = value;

                    self.trigger(CHANGE);

                    // trigger the DOM change event so any subscriber gets notified
                    self.element.trigger(CHANGE);
                }
            },

            _accessor: function (value) {
                var self = this,
                    element = self.element[0];

                if (value !== undefined) {
                    element.value = value === null ? "" : value;
                    //that._placeholder();
                } else {
                    value = element.value;

                    if (element.className.indexOf("k-readonly") > -1) {
                        if (value === self.options.placeholder) {
                            return "";
                        } else {
                            return value;
                        }
                    }

                    return value;
                }
            },

            setDataSource: function(dataSource) {
                this.options.dataSource = dataSource;
                this._initDataSource();
            },

            setLineStartDate: function(startDate) {
                this.options.lineStartDate = startDate;
                this._initStartDateTime();
            },

            setLineStartTime: function(startTime) {
                this.options.lineStartTime = startTime;
                this._initStartDateTime();
            },

            _initList: function() {
                var self = this;

                /* Hierarchy:
                div                                 (self.wrapper)
                  input[data-ml="input"]            (self.element)
                  div[data-ml="floats"]
                    div[data-ml="matches"]
                    div[data-ml="hint"]
                    div[data-ml="no-matches"]
                    div[data-ml="more-matches"]
                */

                // Create our floats wrapper
                self.floats = $('<div data-ml="floats" class="vm-ml-floats k-tooltip"></div>');

                // Create our other elements
                self.matchesList = $('<div data-ml="matches" class="vm-ml-matches"></div>')
                    .kendoListView({
                        template: self._rowTemplate,
                        dataSource: new kendo.data.DataSource({ data: [], pageSize: self.options.pageSize }),
                        selectable: 'single',
                        change: $.proxy(self._onMatchListViewChange, self)
                    })
                    .dblclick($.proxy(self.hideFloats, self))
                    .data('kendoListView');

                self.hintText = $('<div data-ml="hint" class="vm-ml-hinttext">' +
                    self.options.hintMessage +
                    '</div>');

                self.noMatches = $('<div data-ml="no-matches" class="vm-ml-hinttext vm-ml-no-matches">' +
                    self.options.noMatchesMessage +
                    '</div>');

                self.matchesMore = $('<div data-ml="more-matches" class="vm-ml-hinttext">' +
                    self.options.moreMatchesMessage.replace('{0}', self.options.pageSize) +
                    '</div>');

                // Insert them into our floats wrapper
                self.floats.append(self.matchesList.element);
                self.floats.append(self.hintText);
                self.floats.append(self.noMatches);
                self.floats.append(self.matchesMore);
            },

            _initPopup: function() {
                var that = this,
                    //focused = that._focused,
                    options = that.options,
                    wrapper = that.wrapper;

                that.popup = new kendo.ui.Popup(that.floats, $.extend({}, options.popup, {
                    anchor: wrapper,
                    open: function(e) {
                    },
                    close: function(e) {
                    },
                    animation: options.animation,
                    isRtl: kendo.support.isRtl(wrapper)
                }));

                that._touchScroller = kendo.touchScroller(that.popup.element);
            },

            _initDataSource: function() {
                var self = this;

                if (self.dataSource && self._refreshHandler) {
                    self.dataSource.unbind(CHANGE, self._refreshHandler);
                } else {
                    self._refreshHandler = $.proxy(self.refresh, self);
                }

                if (!(self.options.dataSource instanceof kendo.data.DataSource))
                    self.dataSource = kendo.data.DataSource.create(self.options.dataSource);
                else
                    self.dataSource = self.options.dataSource;

                self.dataSource.bind(CHANGE, self._refreshHandler);

                if (self.options.autoBind) {
                    self.dataSource.fetch();
                }
            },

            _initStartDateTime: function() {
                if (!this.options.lineStartDate)
                    throw new Error("Invalid line start date");
                this._startDateTime = $.toDateFromParts(this.options.lineStartDate, this.options.lineStartTime).getTime();
            },

            _initRowTemplate: function() {
                this._rowTemplate = kendo.template(
                    this.options.rowTemplate ||
                    '<div class="vm-ml-row">'+
                    '   <div class="vm-ml-row-primary">#= PatientIdLOV #</div>'+
                    '   <div class="vm-ml-row-meta">#= PatientGivenName # #= PatientSurname #</div>'+
                    '</div>'
                );
            },

            options: {
                name: 'MagicLookup',
                autoBind: true,
                pageSize: 5,
                lineStartDate: new Date(),
                lineStartTime: '00:00',
                hintMessage: 'Searching patients already entered in this claim.',
                noMatchesMessage: 'No matching patients available.',
                moreMatchesMessage: 'Only showing first {0} results.',
                placeholder: '',
                rowTemplate: null,
                autoFocusTimeout: null,
                value: null,
                animation: {}
            },

            events: [
                DATABINDING,
                DATABOUND
            ],

            items: function() {
                return this.element.children();
            }
        });
        kendo.ui.plugin(MagicLookup);

})(window.kendo.jQuery);

return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });