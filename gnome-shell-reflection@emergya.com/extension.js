/**
 * extension.js
 * Copyright (C) 2011, Junta de Andalucía <devmaster@guadalinex.org>
 *
 * This file is part of Guadalinex
 *
 * This software is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * As a special exception, if you link this library with other files to
 * produce an executable, this library does not by itself cause the
 * resulting executable to be covered by the GNU General Public License.
 * This exception does not however invalidate any other reasons why the
 * executable file might be covered by the GNU General Public License.
 *
 * Author: Antonio Hernández <ahernandez@emergya.com>
 *
 */

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Lang = imports.lang;
const BoxPointer = imports.ui.boxpointer;
const MessageTray = imports.ui.messageTray;
const LookingGlass = imports.ui.lookingGlass;
const PopupMenu = imports.ui.popupMenu;
const AltTab = imports.ui.altTab;

const Side = {
    HIDDEN: 0,
    SHOWN: 1,
    TOP: 2,
    BOTTOM: 3,
    LEFT: 4,
    RIGHT: 5
};

const UPDATE_HOT_CORNERS = Side.HIDDEN;

const INDICATORS = {
    'a11y': Side.HIDDEN
}

let Logger = {
    error: function(msg) {
        if (global.logger) {
            return global.logger.error(msg);
        } else {
            return Main._log('[gs-reflection error]:', msg);
        }
    },
    debug: function(msg) {
        if (global.logger) {
            return global.logger.error(msg);
        } else {
            return Main._log('[gs-reflection debug]:', msg);
        }
    },
    notify: function(msg, details, isTransient) {
        isTransient = typeof(isTransient) == 'boolean' ? isTransient : true;
        let source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);
        let notification = new MessageTray.Notification(source, msg, details);
        notification.setTransient(isTransient);
        source.notify(notification);
    }
};

/**
 * Move the panel to the bottom of the screen.
 */
function updateLayout() {

    Main.layoutManager._updateBoxes = Lang.bind(Main.layoutManager, function() {

        Main.layoutManager.__proto__._updateBoxes.call(this);

        this.panelBox.set_position(this.primaryMonitor.x,
            this.primaryMonitor.y + this.primaryMonitor.height - this.panelBox.height);

        this.trayBox.set_position(this.bottomMonitor.x, this.bottomMonitor.y);

        // Set trayBox's clip to show things above it, but not below
        // it (so it's not visible behind the keyboard). The exact
        // height of the clip doesn't matter, as long as it's taller
        // than any Notification.actor.
        this.trayBox.set_clip(0, 0,
            this.bottomMonitor.width, this.bottomMonitor.height);
    });

    global.screen.emit('monitors-changed');
}

/**
 * Hide the panel corners.
 */
function updatePanelCorner() {

    Main.panel._leftCorner.actor.hide();
    Main.panel._rightCorner.actor.hide();
}

/**
 * Attach the LookingGlass to the chrome,
 * so it will stay on the top of the screen.
 */
function updateLookingGlass() {

    LookingGlass.LookingGlass.prototype._resize = function() {
        let primary = Main.layoutManager.primaryMonitor;
        let myWidth = primary.width * 0.7;
        let availableHeight = primary.height - Main.layoutManager.keyboardBox.height;
        let myHeight = Math.min(primary.height * 0.7, availableHeight * 0.9);
        this.actor.x = (primary.width - myWidth) / 2;
        this._hiddenY = this.actor.get_parent().height - myHeight - 4; // -4 to hide the top corners
        this._targetY = this._hiddenY + myHeight;
        this.actor.y = -primary.height + 30; // +30 to show corners
        this.actor.width = myWidth;
        this.actor.height = myHeight;
        this._objInspector.actor.set_size(Math.floor(myWidth * 0.8), Math.floor(myHeight * 0.8));
        this._objInspector.actor.set_position(this.actor.x + Math.floor(myWidth * 0.1),
                                              this._targetY + Math.floor(myHeight * 0.1));
    };

    LookingGlass.LookingGlass.prototype.open = function() {
        if (this._open)
            return;

        if (!Main.pushModal(this._entry))
            return;

        this._notebook.selectIndex(0);
        this.actor.show();
        this._open = true;
        this._history.lastItem();

        LookingGlass.Tweener.removeTweens(this.actor);
    };

    LookingGlass.LookingGlass.prototype.close = function() {

        if (!this._open)
            return;

        this._objInspector.actor.hide();

        this._open = false;
        LookingGlass.Tweener.removeTweens(this.actor);

        if (this._borderPaintTarget != null) {
            this._borderPaintTarget.disconnect(this._borderPaintId);
            this._borderPaintTarget.disconnect(this._borderDestroyId);
            this._borderPaintTarget = null;
        }

        Main.popModal(this._entry);
        this.actor.hide();
    };
}

/**
 * Move the hot corners to the bottom of the screen
 * or hide them.
 *
 * See UPDATE_HOT_CORNERS constant, some people may want the
 * HotCorner feature back.
 */
function updateHotCorners() {

    Main.layoutManager._updateHotCorners = function() {

        Main.layoutManager.__proto__._updateHotCorners.call(this);

        let cornerX = null;
        let cornerY = null;

        if (UPDATE_HOT_CORNERS == Side.TOP) {

            return;

        } else if (UPDATE_HOT_CORNERS == Side.BOTTOM) {


            // TODO: Currently the animated graphic is not shown.
            // TODO: Currently only handles the primary monitor.
            let primary = Main.layoutManager.primaryMonitor;
            cornerX = 0;
            cornerY = primary.height - 1;

        } else if (UPDATE_HOT_CORNERS == Side.HIDDEN) {

            for (let i = 0; i < this._hotCorners.length; i++) {
                this._hotCorners[i].destroy();
            }
            this._hotCorners = [];

            return;
        }

        try {
            for (let i = 0; i < this._hotCorners.length; i++) {
                let corner = this._hotCorners[i];
                corner.actor.set_position(cornerX, cornerY);
            }
        } catch(e) {
            Logger.error(e);
        }

    };

    global.screen.emit('monitors-changed');
}

/**
 * Tray icons modifications.
 */
function updateTrayIcons() {

    // Remove indicators specified in INDICATORS array.
    for (let role in INDICATORS) {
        let indicator = Main.panel._statusArea[role];
        if (INDICATORS[role] != Side.HIDDEN || !indicator) {
            continue;
        }
        let children = Main.panel._rightBox.get_children();
        for (let i = children.length - 1; i >= 0; i--) {
            if (indicator.actor === children[i]) {
                indicator.actor.destroy();
            }
        }
    }
}

/**
 * Make the menus open to top.
 */
function updateMenus() {

    // New menus inherits the new behavior.
    BoxPointer.BoxPointer.prototype._arrowSide = St.Side.BOTTOM;

    Main.statusIconDispatcher.connect('status-icon-added', function(o, icon, role) {

        // Missed a reference to the menu object in this callback,
        // need to traverse all the menus.
        Main.panel._menus._menus.forEach(function(menu) {
            menu.menu._boxPointer._arrowSide = St.Side.BOTTOM;
        });
    });

    // Be sure the signal is emitted at least once.
    try {
        Main.statusIconDispatcher.emit('status-icon-added');
    } catch (e) {
        Logger.log(e);
    }
}

/**
 * Move the message tray to the top of the screen.
 */
function updateMessageTray() {

    // Change the direction of the animation when showing the tray bar.
    Main.messageTray._showTray = Lang.bind(Main.messageTray, function() {

        this._tween(this.actor, '_trayState', MessageTray.State.SHOWN,
                    { y: 0,
                      time: MessageTray.ANIMATION_TIME,
                      transition: 'easeOutQuad'
                    });
    });

    // Change the direction of the animation when hiding the tray bar.
    Main.messageTray._hideTray = Lang.bind(Main.messageTray, function() {

        this._tween(this.actor, '_trayState', MessageTray.State.HIDDEN,
                    { y: -this.actor.height + 1,
                      time: MessageTray.ANIMATION_TIME,
                      transition: 'easeOutQuad'
                    });
    });

    // Align summary items to the left
    Main.messageTray._summaryBin.x_align = St.Align.START;

    // SummaryItems menus.
    Main.messageTray._summaryBoxPointer._arrowSide = St.Side.TOP;

    Main.messageTray._hideTray();
}

function sortNotificationElements(tableContainer) {

    // Children at this point:
    //      0 -> this._bannerBox
    //      1 -> St.Bin
    //      2 -> this._icon
    //      3 -> ScrollView

    let children = tableContainer.get_children();
    if (children.length == 3)
        return;

    let banner = children[0];
    let stbin = children[1];
    let icon = children[2];
    let scrollview = children[3];

    for (let i = 0, l = children.length; i<l; i++) {
        tableContainer.remove_actor(children[i]);
    }

    tableContainer.add(banner, { row: 1,
                                   col: 1,
                                   col_span: 2,
                                   x_expand: false,
                                   y_expand: false,
                                   y_fill: false });
    tableContainer.add(stbin, { row: 1,
                                    col: 2,
                                    y_expand: false,
                                    y_fill: false });
    tableContainer.add(icon, { row: 1,
                                  col: 0,
                                  x_expand: false,
                                  y_expand: false,
                                  y_fill: false,
                                  y_align: St.Align.START });
    tableContainer.add(scrollview, { row: 0,
                                        col: 2 });
}

/**
 * Change the notifications styles according to the new position.
 */
function updateNotifications() {

    let update = MessageTray.Notification.prototype.update;
    MessageTray.Notification.prototype.update = function(title, banner, params) {
        update.call(this, title, banner, params);
        sortNotificationElements(this._table);
    };

    Main.messageTray._updateShowingNotification = Lang.bind(Main.messageTray, function() {
        MessageTray.Tweener.removeTweens(this._notificationBin);
        if (this._notification.urgency == MessageTray.Urgency.CRITICAL || this._notification.expanded)
            this._expandNotification(true);
        let tweenParams = { opacity: 255,
                            time: MessageTray.ANIMATION_TIME,
                            transition: 'easeOutQuad',
                            onComplete: this._showNotificationCompleted,
                            onCompleteScope: this
                          };
        if (!this._notification.expanded)
            //tweenParams.y = 0;
            tweenParams.y = -this._notification.actor.height + this.actor.height;

        this._tween(this._notificationBin, '_notificationState', MessageTray.State.SHOWN, tweenParams);
    });

    Main.messageTray._updateState = Lang.bind(Main.messageTray, function() {
        let notificationUrgent = this._notificationQueue.length > 0 && this._notificationQueue[0].urgency == MessageTray.Urgency.CRITICAL;
        let notificationsPending = this._notificationQueue.length > 0 && (!this._busy || notificationUrgent);
        let notificationPinned = this._pointerInTray && !this._pointerInSummary && !this._notificationRemoved;
        // ---
        let notificationExpanded = this._notificationBin.y == 0;
        let notificationExpired = (this._notificationTimeoutId == 0 && !(this._notification && this._notification.urgency == MessageTray.Urgency.CRITICAL) && !this._pointerInTray && !this._locked && !(this._pointerInKeyboard && notificationExpanded)) || this._notificationRemoved;
        let canShowNotification = notificationsPending && this._summaryState == MessageTray.State.HIDDEN;
        if (this._notificationState == MessageTray.State.HIDDEN) {
            if (canShowNotification)
                this._showNotification();
        } else if (this._notificationState == MessageTray.State.SHOWN) {
            if (notificationExpired)
                this._hideNotification();
            else if (notificationPinned && !notificationExpanded)
                this._expandNotification(false);
            else if (notificationPinned)
                this._ensureNotificationFocused();
        }
        let summarySummoned = this._pointerInSummary || this._overviewVisible ||  this._traySummoned;
        let summaryPinned = this._summaryTimeoutId != 0 || this._pointerInTray || summarySummoned || this._locked;
        let summaryHovered = this._pointerInTray || this._pointerInSummary;
        let summaryVisibleWithNoHover = (this._overviewVisible || this._locked) && !summaryHovered;
        let summaryNotificationIsForExpandedSummaryItem = (this._clickedSummaryItem == this._expandedSummaryItem);
        let notificationsVisible = (this._notificationState == MessageTray.State.SHOWING ||
                                    this._notificationState == MessageTray.State.SHOWN);
        let notificationsDone = !notificationsVisible && !notificationsPending;
        let summaryOptionalInOverview = this._overviewVisible && !this._locked && !summaryHovered;
        let mustHideSummary = (notificationsPending && (notificationUrgent || summaryOptionalInOverview))
                              || notificationsVisible;
        if (this._summaryState == MessageTray.State.HIDDEN && !mustHideSummary) {
            if (this._backFromAway) {
                this._backFromAway = false;
                if (!this._busy)
                    this._showSummary(MessageTray.LONGER_SUMMARY_TIMEOUT);
            } else if (notificationsDone && this._newSummaryItems.length > 0 && !this._busy) {
                this._showSummary(MessageTray.SUMMARY_TIMEOUT);
            } else if (summarySummoned) {
                this._showSummary(0);
            }
        } else if (this._summaryState == MessageTray.State.SHOWN) {
            if (!summaryPinned || mustHideSummary)
                this._hideSummary();
            else if (summaryVisibleWithNoHover && !summaryNotificationIsForExpandedSummaryItem)
                this._setExpandedSummaryItem(null);
        }
        let haveClickedSummaryItem = this._clickedSummaryItem != null;
        let summarySourceIsMainNotificationSource = (haveClickedSummaryItem && this._notification &&
                                                     this._clickedSummaryItem.source == this._notification.source);
        let canShowSummaryBoxPointer = this._summaryState == MessageTray.State.SHOWN;
        let requestedNotificationStackIsEmpty = (this._clickedSummaryItemMouseButton == 1 && this._clickedSummaryItem.source.notifications.length == 0);
        let wrongSummaryNotificationStack = (this._clickedSummaryItemMouseButton == 1 &&
                                             this._summaryBoxPointer.bin.child != this._clickedSummaryItem.notificationStackView);
        let wrongSummaryRightClickMenu = (this._clickedSummaryItemMouseButton == 3 &&
                                          this._summaryBoxPointer.bin.child != this._clickedSummaryItem.rightClickMenu);
        let wrongSummaryBoxPointer = (haveClickedSummaryItem &&
                                      (wrongSummaryNotificationStack || wrongSummaryRightClickMenu));
        if (this._summaryBoxPointerState == MessageTray.State.HIDDEN) {
            if (haveClickedSummaryItem && !summarySourceIsMainNotificationSource && canShowSummaryBoxPointer && !requestedNotificationStackIsEmpty)
                this._showSummaryBoxPointer();
        } else if (this._summaryBoxPointerState == MessageTray.State.SHOWN) {
            if (!haveClickedSummaryItem || !canShowSummaryBoxPointer || wrongSummaryBoxPointer || mustHideSummary)
                this._hideSummaryBoxPointer();
        }
        let trayIsVisible = (this._trayState == MessageTray.State.SHOWING ||
                             this._trayState == MessageTray.State.SHOWN);
        let trayShouldBeVisible = (!notificationsDone ||
                                   this._summaryState == MessageTray.State.SHOWING ||
                                   this._summaryState == MessageTray.State.SHOWN);
        if (!trayIsVisible && trayShouldBeVisible)
            this._showTray();
        else if (trayIsVisible && !trayShouldBeVisible)
            this._hideTray();
    });

    Main.messageTray._onNotificationExpanded = Lang.bind(Main.messageTray, function() {
        let expandedY = this.actor.height - this._notificationBin.height;

        // Don't animate the notification to its new position if it has shrunk:
        // there will be a very visible "gap" that breaks the illusion.

        if (this._notificationBin.y < expandedY)
            this._notificationBin.y = expandedY;
        else if (this._notification.y != expandedY)
            this._tween(this._notificationBin, '_notificationState', MessageTray.State.SHOWN,
                        { y: 0,
                          time: MessageTray.ANIMATION_TIME,
                          transition: 'easeOutQuad'
                        });
    });

    // Change the direction of the animation when hiding the notification.
    Main.messageTray._hideNotification = Lang.bind(Main.messageTray, function() {

        this._focusGrabber.ungrabFocus();
        if (this._notificationExpandedId) {
            this._notification.disconnect(this._notificationExpandedId);
            this._notificationExpandedId = 0;
        }

        this._tween(this._notificationBin, '_notificationState', MessageTray.State.HIDDEN,
                    { y: -this.actor.height,
                      opacity: 0,
                      time: MessageTray.ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: this._hideNotificationCompleted,
                      onCompleteScope: this
                    });
    });

    // Suppress the animation when the mouse is over the notification.
    //Main.messageTray._onNotificationExpanded = Lang.bind(Main.messageTray, function() {
    //});
}

function main(meta) {

    updateLayout();
    updateLookingGlass();
    updatePanelCorner();
    updateMenus();
    updateHotCorners();
    updateTrayIcons();
    updateMessageTray();
    updateNotifications();
}

function init(meta) {
}

function enable(meta) {
    main(meta);
}

function disable() {
}
