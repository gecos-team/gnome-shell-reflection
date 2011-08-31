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
const TRAY_ICON_ACCESSIBILITY = Side.HIDDEN;

Logger = {
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
function updatePanel() {

    Main.panel.relayout = Lang.bind(Main.panel, function() {
    
        this.__proto__.relayout.call(this);
        
        let primary = Main.layoutManager.primaryMonitor;
        this.actor.set_position(primary.x, primary.y + primary.height - this.actor.height);
    });
}

/**
 * Hide the panel corners.
 */
function updatePanelCorner() {
        
    let relayout = function() {
        let node = this.actor.get_theme_node();

        let cornerRadius = node.get_length("-panel-corner-radius");
        let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');

        this.actor.set_size(cornerRadius, innerBorderWidth + cornerRadius);            
        this.actor.set_position(-Main.panel.actor.width, -Main.panel.actor.height);
    };
    
    Main.panel._leftCorner.relayout = Lang.bind(Main.panel._leftCorner, relayout);
    Main.panel._rightCorner.relayout = Lang.bind(Main.panel._rightCorner, relayout);
}

/**
 * Attach the LookingGlass to the messageTray parent,
 * so it will stay on the top of the screen.
 */
function updateLookingGlass() {

    Main.lookingGlass = new LookingGlass.LookingGlass();
    Main.lookingGlass.slaveTo(Main.messageTray.actor.get_parent());
}

/**
 * Move the hot corners to the bottom of the screen
 * or hide them.
 * 
 * See UPDATE_HOT_CORNERS constant, some people may want the
 * HotCorner feature back.
 */
function updateHotCorners() {

    function setHotCornerPosition(corner, monitor) {
    
        let cornerX = null;
        let cornerY = null;
        
        if (UPDATE_HOT_CORNERS == Side.TOP) {
            
            return;
            
        } else if (UPDATE_HOT_CORNERS == Side.BOTTOM) {
    
            // TODO: Currently the animated graphic is not shown.
            let pos = corner.actor.get_position();
            cornerX = pos[0];
            cornerY = pos[1] + monitor.height - 1;
            
        } else if (UPDATE_HOT_CORNERS == Side.HIDDEN) {
        
            cornerX = -1;
            cornerY = -1;
        }
        
        try {
            corner.actor.set_position(cornerX, cornerY);
        } catch(e) {
            Logger.error(e);
        }
    }
    
    let _relayout = Main._relayout;
    
    Main._relayout = (function(_relayout) {
        return function() {
        
            _relayout();
            
            // TODO: Currently only uses the primary monitor, need to create
            // a HotCorner in each monitor.
            let primary = Main.layoutManager.primaryMonitor;
    
            for (let i = 0, l = Main.hotCorners.length; i < l; i++) {
                let corner = Main.hotCorners[i];
                setHotCornerPosition(corner, primary);
            }
        }
    })(_relayout);
}

/**
 * Tray icons modifications.
 */
function updateTrayIcons() {

    // Remove the accessibility icon.
    if (TRAY_ICON_ACCESSIBILITY == Side.HIDDEN)
        delete Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['a11y'];
}

/**
 * Make the menus open to top.
 */
function updateMenus() {

    // New menus inherits the new behavior.
    BoxPointer.BoxPointer.prototype._arrowSide = St.Side.BOTTOM;

    // Wait until all the indicators are loaded, so we can change all the menus.
    Main.panel.startStatusArea = Lang.bind(Main.panel, function() {
    
        this.__proto__.startStatusArea.call(this);

        this._menus._menus.forEach(function(menu) {
            menu.menu._boxPointer._arrowSide = St.Side.BOTTOM;
        });
    });
}

/**
 * Move the message tray to the top of the screen.
 */
function updateMessageTray() {
    
    // Align summary items to the left
    Main.messageTray._summaryBin.x_align = St.Align.START;

    // Move the message tray to the top of the screen.
    Main.messageTray._setSizePosition = Lang.bind(Main.messageTray, function() {
    
        this.__proto__._setSizePosition.call(this);

        let primary = Main.layoutManager.primaryMonitor;
        this.actor.y = primary.y - this.actor.height + 1;
        
        this._pointerBarrier =
            global.create_pointer_barrier(primary.x + primary.width, primary.y + this.actor.height,
                                          primary.x + primary.width, primary.y,
                                           4 /* BarrierNegativeX */);
    });

    // Change the direction of the animation when showing the tray bar.
    Main.messageTray._showTray = Lang.bind(Main.messageTray, function() {
    
        //this.__proto__._showTray.call(this);

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
    
        //this.__proto__._hideTray.call(this);
        
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
    Main.messageTray._onNotificationExpanded = Lang.bind(Main.messageTray, function() {
    });
    
    // SummaryItems menus.
    Main.messageTray._summaryBoxPointer._arrowSide = St.Side.TOP;

    Main.messageTray._setSizePosition();
}

/**
 * Fix the switch backward feature (ALT+SHIFT+TAB)
 */
function fixAltTab() {

    AltTab.AltTabPopup.prototype._keyPressEvent = function(actor, event) {
        
        let keysym = event.get_key_symbol();
        let event_state = AltTab.Shell.get_event_state(event);
        let backwards = event_state & AltTab.Clutter.ModifierType.SHIFT_MASK;
        let action = global.screen.get_display().get_keybinding_action(event.get_key_code(), event_state);

        this._disableHover();

        if (action == AltTab.Meta.KeyBindingAction.SWITCH_GROUP
            || action == AltTab.Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD)
            this._select(this._currentApp, backwards ? this._previousWindow() : this._nextWindow());
        else if (keysym == AltTab.Clutter.Escape)
            this.destroy();
        else if (this._thumbnailsFocused) {
            if (action == AltTab.Meta.KeyBindingAction.SWITCH_WINDOWS
                || action == AltTab.Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD)
                if (backwards) {
                    if (this._currentWindow == 0 || this._currentWindow == -1)
                        this._select(this._previousApp());
                    else
                        this._select(this._currentApp, this._previousWindow());
                } else {
                    if (this._currentWindow == this._appIcons[this._currentApp].cachedWindows.length - 1)
                        this._select(this._nextApp());
                    else
                        this._select(this._currentApp, this._nextWindow());
                }
            else if (keysym == AltTab.Clutter.Left)
                this._select(this._currentApp, this._previousWindow());
            else if (keysym == AltTab.Clutter.Right)
                this._select(this._currentApp, this._nextWindow());
            else if (keysym == AltTab.Clutter.Up)
                this._select(this._currentApp, null, true);
        } else {
            if (action == AltTab.Meta.KeyBindingAction.SWITCH_WINDOWS
                || action == AltTab.Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD)
                this._select(backwards ? this._previousApp() : this._nextApp());
            else if (keysym == AltTab.Clutter.Left)
                this._select(this._previousApp());
            else if (keysym == AltTab.Clutter.Right)
                this._select(this._nextApp());
            else if (keysym == AltTab.Clutter.Down)
                this._select(this._currentApp, 0);
        }

        return true;
    };
}

/**
 * Debugging purposes.
 * @param label
 * @param callback
 */
function debugAddMenuItem(label, callback) {

    try {
        
        label = label || "Debug item..."
        callback = callback || function() {
            Logger.notify("404", "Nothing to notify", false);
        }
        
        let item = null;
        let children = Main.panel._leftBox.get_children();
        let appMenu = Main.panel._applicationsmenu;
        
        item = new PopupMenu.PopupSeparatorMenuItem();
        appMenu.menu.addMenuItem(item);
        
        item = new PopupMenu.PopupMenuItem(_(label));
        item.connect('activate', callback);
        appMenu.menu.addMenuItem(item);
        
    } catch (e) {
        Logger.error(e);
    }
}

function main(extensionMeta) {

	/*
    Logger.debug("extensionMeta: ");
    for (let o in extensionMeta) {
        Logger.debug(o + ": " + extensionMeta[o]);
    }
    */
            
    try {
        
        updatePanel();
        updatePanelCorner();
        updateMenus();
        updateHotCorners();
        updateTrayIcons();
        updateMessageTray();
        updateLookingGlass();
        fixAltTab();
        
    } catch(e) {
        Logger.error(e);
    }
}
