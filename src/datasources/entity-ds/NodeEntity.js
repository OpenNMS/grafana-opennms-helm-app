import _ from 'lodash';

import Entity from './Entity';
import { AttributeMapping } from './mapping/AttributeMapping';

const columns = [
  { text: 'ID', resource: 'id' },
  { text: 'Label', resource: 'label', featured: true, },
  { text: 'Label Source', resource: 'labelSource' },
  { text: 'Foreign Source', resource: 'foreignSource', featured: true, },
  { text: 'Foreign ID', resource: 'foreignId', featured: true, },
  { text: 'Location', resource: 'location.locationName' },
  { text: 'Creation Time', resource: 'createTime', featured: true, },
  { text: 'Parent ID', resource: 'parent.id' },
  { text: 'Parent Foreign Source', resource: 'parent.foreignSource' },
  { text: 'Parent Foreign ID', resource: 'parent.foreignId' },
  { text: 'Type', resource: 'type' },
  { text: 'SNMP sysObjectID', resource: 'sysObjectId' },
  { text: 'SNMP sysName', resource: 'sysName' },
  { text: 'SNMP sysDescription', resource: 'sysDescription' },
  { text: 'SNMP sysLocation', resource: 'sysLocation' },
  { text: 'SNMP sysContact', resource: 'sysContact' },
  { text: 'NETBIOS/SMB Name', resource: 'netBiosName' },
  { text: 'NETBIOS/SMB Domain', resource: 'netBiosDomain' },
  { text: 'Operating System', resource: 'operatingSystem' },
  { text: 'Last Poll Time', resource: 'lastCapsdPoll' },
  /* { text: 'Primary SNMP Physical Address', resource: 'ipInterface.snmpInterface.physAddr' }, */
  { text: 'Primary SNMP ifIndex', resource: 'snmpInterface.ifIndex' },
  { text: 'Primary IP Interface', resource: 'ipInterface.ipAddress' },
  /* { text: 'Primary IP Hostname', resource: 'ipInterface.ipHostname' }, */
  { text: 'Categories', resource: 'category.name', featured: true, },
  { text: 'Data Source' }
];

const mapping = new AttributeMapping({
  category: 'category.name',
  categories: 'category.name',
  'categories.name': 'category.name',
  ifIndex: 'snmpInterface.ifIndex',
  ipAddr: 'ipInterface.ipAddress',
  ipAddress: 'ipInterface.ipAddress',
  ipHostname: 'ipInterface.ipHostname',
  location: 'location.locationName',
  parentId: 'parent.id',
  parentForeignSource: 'parent.foreignSource',
  parentForeignId: 'parent.foreindId',
});

export default class NodeEntity extends Entity {
  constructor(client, datasource) {
    super(client, datasource);
    this.type = 'node';
  }

  getAttributeMapping() {
    return mapping;
  }

  getColumns() {
    return columns;
  }

  async query(filter) {
    const self = this;

    const nodes = await this.client.findNodes(filter);

    let getPrimary = (node) => {
      if (node && node.ipInterfaces) {
          let primary = node.ipInterfaces.filter(iface => {
              return iface.snmpPrimary && iface.snmpPrimary.isPrimary();
          })[0];
          return primary;
      }
      return undefined;
    };

    const rows = _.map(nodes, node => {
      const primaryIpInterface = getPrimary(node);
      const primarySnmp = primaryIpInterface && primaryIpInterface.snmpInterface;

      return [
          node.id,
          node.label,
          node.labelSource,
          node.foreignSource,
          node.foreignId,
          node.location,
          node.createTime,
          node.parent ? node.parent.id : undefined,
          node.parent ? node.parent.foreignSource : undefined,
          node.parent ? node.parent.foreignId : undefined,
          node.type ? node.type.toDisplayString() : undefined,
          node.sysObjectId,
          node.sysName,
          node.sysDescription,
          node.sysLocation,
          node.sysContact,
          node.netBiosName,
          node.netBiosDomain,
          node.operatingSystem,
          node.lastCapsdPoll,
          // primarySnmp && primarySnmp.physAddr ? primarySnmp.physAddr.toString() : undefined,
          primarySnmp ? primarySnmp.ifIndex : undefined,
          primaryIpInterface && primaryIpInterface.ipAddress ? primaryIpInterface.ipAddress.correctForm() : undefined,
          // primaryIpInterface && primaryIpInterface.ipHostname ? primaryIpInterface.ipHostname : undefined,
          node.categories ? node.categories.map(cat => cat.name) : undefined,

          // Data Source
          self.name
      ];
    });

    const metas = _.map(nodes, node => {
      return {
        // Store the node for easy access by the panels
        'node': node,
        // Store the entity type
        'type': 'node',
        // Store the name of the data-source as part of the data so that
        // the panel can grab an instance of the DS to perform actions
        // on the nodes, if necessary
        'source': this.datasource.name,
      }
    });

    return [
      {
        'columns': columns,
        'meta': {
          entity_metadata: metas,
        },
        'rows': rows,
        'type': 'table',
      }
    ];
  }
}
