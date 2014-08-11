(function(f, define){
    define([], f);
})(function(){

    (function($) {
        var kendo = window.kendo = window.kendo || { cultures: {} };

        /** KENDO EXTENSION - Expander Box **/

        var DOUBLECLICK = 'dblclick',
            CLICK = 'click',
            EXPANDERROLE_QRY = '[data-role="expander"]',
            EXPANDERHEADERTEXT_ATTR = 'data-header-text',
            EXPANDERHEADERROLE_ATTR = 'expander-header',
            EXPANDERHEADERROLE_QRY = '[data-role="expander-header"]',
            EXPANDERHEADERICONROLE_ATTR = 'expander-icon',
            EXPANDERHEADERICONROLE_QRY = '[data-role=expander-icon]',
            EXPANDERHEADERACTIONSROLE = '[data-role="expander-header-actions"]',
            EXPANDERCONTENTROLE = '[data-role="expander-content"]',
            EXPANDERCLASS = 'fg-expander',
            EXPANDERHEADERCLASS = 'fg-expander-header',
            EXPANDERHEADERACTIONSCLASS = 'fg-expander-actions',
            EXPANDERCONTENTCLASS = 'fg-expander-content',
            EXPANDERVISIBLECLASS = 'fg-expander-open',
            EXPANDERHIDDENCLASS = 'fg-expander-closed',
            EXPANDERHEADERICON_CLASS = 'k-sprite fg-expander-icon'
            ns = '.expander';

        var Expander = kendo.ui.Widget.extend({
            init: function(element, options) {
                var self = this,
                    $elem,
                    expandedVal,
                    $header,
                    $headerH2,
                    $headerActions,
                    headerText;

                // Base initialization
                kendo.ui.Widget.fn.init.call(this, element, options);

                /*
                Input HTML
                <div data-role="expander"
                     data-expanded="false"
                     data-header-text="some arbitrary title (can be html)">

                    <!-- Optional: provide some actions -->
                    <div data-role="expander-header-actions">
                        <a data-role="button" data-bind="click: onAddLineClick" data-icon="fff-add">Add Line</a>
                    </div>

                    <!-- This div contains the content that will have its visibility toggled.
                    <div data-role="expander-content">
                        <!-- Arbitrary content here -->
                    </div>
                </div>


                Output HTML

                 */

                $elem = $(element);

                $header = $elem.find(EXPANDERHEADERROLE_QRY);
                if ($header.size() == 0) {
                    $header = $('<div />')
                        .attr('data-role', EXPANDERHEADERROLE_ATTR);
                    $elem.prepend($header);
                }

                headerText = $.trim($elem.attr(EXPANDERHEADERTEXT_ATTR));
                if (headerText.length > 0) {
                    $headerH2 = $header.find('h2');
                    if ($headerH2.size() == 0) {
                        $headerH2 = $('<h2 />');
                        $header.prepend($headerH2);
                    }
                    $headerH2.html(headerText);
                }

                // Expander icon
                $header.prepend(
                    $('<span />')
                        .attr('data-role', EXPANDERHEADERICONROLE_ATTR)
                        .addClass(EXPANDERHEADERICON_CLASS)
                );

                $headerActions = $elem.find(EXPANDERHEADERACTIONSROLE);
                if ($headerActions.size()) {
                    // Move the header actions to the Header parent element.
                    $header.prepend($headerActions);
                }

                // Apply our styling
                $elem.addClass(EXPANDERCLASS);
                $header.addClass(EXPANDERHEADERCLASS);
                $headerActions.addClass(EXPANDERHEADERACTIONSCLASS);
                $elem.find(EXPANDERCONTENTROLE).addClass(EXPANDERCONTENTCLASS);

                // Initially hidden?
                expandedVal = $elem.data('expanded') === true;
                if (!expandedVal) {
                    $elem.addClass(EXPANDERHIDDENCLASS)
                        .find(EXPANDERCONTENTROLE)
                        .hide();
                }

                self.wrapper = $elem;

                self._initEvents();

                self.refresh();
            },

            _initEvents: function() {

                var $elem = this.wrapper,
                    $target,
                    animTime = this.options.animTime,
                    handleExpand;

                handleExpand = function(evt) {
                    $elem = $(this);

                    $elem = $elem.is(EXPANDERROLE_QRY) ? $elem : $elem.parents(EXPANDERROLE_QRY).first();
                    $target = $elem.find(EXPANDERCONTENTROLE);
                    if ($target.is(':visible')) {
                        $elem
                            .removeClass(EXPANDERVISIBLECLASS)
                            .addClass(EXPANDERHIDDENCLASS);
                        $target.slideUp(animTime);
                    }
                    else {
                        $elem.removeClass(EXPANDERHIDDENCLASS)
                            .addClass(EXPANDERVISIBLECLASS)
                        $target.slideDown(animTime);
                    }

                    if (evt.preventDefault)
                        evt.preventDefault();
                };

                // Attach events
                $elem.find(EXPANDERHEADERROLE_QRY).on(DOUBLECLICK + ns, handleExpand);
                $elem.find(EXPANDERHEADERICONROLE_QRY).on(CLICK + ns, handleExpand);
            },

            destroy: function() {

                this.wrapper.off(ns);

                Widget.fn.destroy.call(this);
            },

            refresh: function() {

            },

            options: {
                name: 'Expander',
                outerWrapClass: 'k-widget vm-lookup',
                innerWrapClass: 'k-picker-wrap k-state-default',
                animTime: 200
            }
        });
        kendo.ui.plugin(Expander);

    })(window.kendo.jQuery);

    return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });