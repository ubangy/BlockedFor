// This app intends to display the number of days a story is/was blocked for

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    
    infinity: new Date('9999-01-01T00:00:00.000Z'),
        
    launch: function() {        
        this._loadDatePicker();
    },
    
    _getFiltersForSnapshotData: function() {
        
        var currentProject = Rally.environment.getContext().getProject();
                
        var projectfilter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: 'Project',
            operation: '=',
            value: currentProject.ObjectID
        });
        
        var typeFilter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_TypeHierarchy',
            operation: '=',
            value: 'HierarchicalRequirement'
        });
        
        var blockedFilter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: 'Blocked',
            operation: '=',
            value: true
        });
        
        var previousBlockedFilter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_PreviousValues.Blocked',
            operation: '=',
            value: false
        });
                
        return projectfilter.and(typeFilter).and(blockedFilter).and(previousBlockedFilter);
    },
    
    _loadDatePicker: function() {
        var me = this;
        
        var startDate = Rally.util.DateTime.add(new Date(), "day", -1);
        
        var timePicker = Ext.create('Ext.form.field.Date', {
            fieldLabel: 'Blocked items since',
            value: startDate,
            editable: false,
            listeners: {
                select: function(picker, newDate) {
                    me._loadSnapshotData(newDate);
                },
                afterrender: function() {
                    me._loadSnapshotData(startDate);
                }
            }
        });
        
        me.add(timePicker);
    },
    
    _loadSnapshotData: function(blockedDate) {
        var me = this;
        
        me.dateBefore = blockedDate;
            
        var myFilters = this._getFiltersForSnapshotData();
        
        // If store exists, just reload new data
        if (me.snapshotStore) {
            me.snapshotStore.reload();
        } else {
        
            me.snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', {
                filters: myFilters,
                fetch: ['FormattedID', '_ValidFrom', '_ValidTo', 'BlockedReason', 'Name']
            });
        
            me.snapshotStore.load({
                params : {
                    removeUnauthorizedSnapshots : true
                },
                callback : function(records) {
                    _.each(records, function(record) {
                        record.set('_type', 'hierarchicalrequirement');
                        record.set('_ref', '/hierarchicalrequirement/' + record.get('ObjectID'));
                    });
                
                    me.snapshotStore.filterBy(function(item) {
                       return Rally.util.DateTime.getDifference(new Date(item.get('_ValidFrom')), new Date(me.dateBefore), 'hour') > 0;
                    });               
                }
            });
        
            if (!me.grid) {
                me._createGrid(me.snapshotStore);
            }
        }
    },
    
    _createGrid: function(store) {
        var me = this;
        
        me.grid = Ext.create('Rally.ui.grid.Grid', {
            columnHeader: false,
            store: store,
            sortableColumns: false, // TODO: Fix this later. Not working due to bug.
            columnCfgs: [
                { text: 'Story ID',  dataIndex: 'FormattedID', xtype: 'templatecolumn', tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate') },
                { text: 'Story Name',  dataIndex: 'Name' },
                { text: 'Blocked Reason',  dataIndex: 'BlockedReason' },
                { text: 'Blocked On',  dataIndex: '_ValidFrom', xtype: 'datecolumn', format: 'd M Y' },
                { text: 'For',  renderer: function(value, metadata, record){ return me._calcBlockedTime(record); } }
            ]
        });
        
        me.add(me.grid);
    },
    
    _calcBlockedTime: function(dateRec) {
    
        var from = new Date(dateRec.get('_ValidFrom'));
        var to = new Date(dateRec.get('_ValidTo'));
        var stillBlocked = '';
        
        if (Ext.Date.isEqual(to, this.infinity)) {
            to = new Date();
            stillBlocked = ' <span class="icon-blocked" style="color: #ee1c25;"></span>';
        }
        
        var dt = Rally.util.DateTime.getDifference(to, from, 'day');
        if (dt === 0) {
            return Rally.util.DateTime.getDifference(to, from, 'hour') + ' hour(s)' + stillBlocked;
        }
        
        return dt + ' day(s)' + stillBlocked;
    }
});
