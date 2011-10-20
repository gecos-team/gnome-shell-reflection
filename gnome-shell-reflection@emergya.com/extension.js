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
 * Authors:: Antonio Hernández (mailto:ahernandez@emergya.com)
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
        return Main._log('[gs-reflection error]:', msg);
    },
    debug: function(msg) {
        return Main._log('[gs-reflection debug]:', msg);
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
        this.panelBox.set_size(this.primaryMonitor.width, -1);

        this.trayBox.set_position(this.bottomMonitor.x, this.bottomMonitor.y);
        this.trayBox.set_size(this.bottomMonitor.width, -1);
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

    Main.createLookingGlass = function() {
        if (Main.lookingGlass == null) {
            Main.lookingGlass = new Main.LookingGlass.LookingGlass();
            Main.layoutManager.panelBox.remove_actor(Main.lookingGlass.actor);
            Main.layoutManager._chrome.addActor(Main.lookingGlass.actor);
        }
        return Main.lookingGlass;
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
        if (INDICATORS[role] != Side.HIDDEN)
            continue;
        let indicator = Main.panel._statusArea[role];
        Main.panel._statusBox.remove_actor(indicator.actor);
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

        let State = MessageTray.State;
        let ANIMATION_TIME = MessageTray.ANIMATION_TIME;

        let primary = Main.layoutManager.primaryMonitor;
        this._tween(this.actor, '_trayState', State.SHOWN,
                    { y: primary.y,
                      time: ANIMATION_TIME,
                      transition: 'easeOutQuad'
                    });
    });

    // Change the direction of the animation when hiding the tray bar.
    Main.messageTray._hideTray = Lang.bind(Main.messageTray, function() {

        let State = MessageTray.State;
        let ANIMATION_TIME = MessageTray.ANIMATION_TIME;

        let primary = Main.layoutManager.primaryMonitor;
        this._tween(this.actor, '_trayState', State.HIDDEN,
                    { y: primary.y - this.actor.height + 1,
                      time: ANIMATION_TIME,
                      transition: 'easeOutQuad'
                    });
    });

    // Change the direction of the animation when hiding the notification.
    Main.messageTray._hideNotification = Lang.bind(Main.messageTray, function() {

        let State = MessageTray.State;
        let ANIMATION_TIME = MessageTray.ANIMATION_TIME;

        this._focusGrabber.ungrabFocus();
        if (this._notificationExpandedId) {
            this._notification.disconnect(this._notificationExpandedId);
            this._notificationExpandedId = 0;
        }

        this._tween(this._notificationBin, '_notificationState', State.HIDDEN,
                    { y: -this.actor.height,
                      opacity: 0,
                      time: ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: this._hideNotificationCompleted,
                      onCompleteScope: this
                    });
    });

    // Suppress the animation when the mouse is over the notification.
    Main.messageTray.___onNotificationExpanded = Lang.bind(Main.messageTray, function() {
    });

    // Align summary items to the left
    Main.messageTray._summaryBin.x_align = St.Align.START;

    // SummaryItems menus.
    Main.messageTray._summaryBoxPointer._arrowSide = St.Side.TOP;
}

function main(meta) {

    try {

        updateLayout();
        updateLookingGlass();
        updatePanelCorner();
        updateMenus();
        updateHotCorners();
        //updateTrayIcons();
        updateMessageTray();

    } catch(e) {
        Logger.error(e);
    }
}

function init(meta) {
    main(meta);
}

function enable() {
}

function disable() {
}
