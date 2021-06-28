### v7.1.1/v7.1.2

Re-pack with fixes for a plugin signature issue.

### v7.1.0

This release adds support for handling aggregate flow DSCP ToS/QoS values, coming soon in Helm 28.
It also bumps some dependencies, and fixes a bug in the filter panel where not all values would
be shown in select boxes.

### v7.0.0

This release contains a rework of our code to use TypeScript, and a conversion to Grafana's
build toolkit for releasing.  This should fix a number of transient issues we've seen in
startup of the Helm plugin and increase overall stability.

BREAKING: OpenNMS Helm now requires Grafana 7.5 or greater.

### v6.0.1

This release contains a few dependency updates, an internal change to support TypeScript,
and one small change to fix loading the flow datasource.

### v6.0.0

OpenNMS Helm now supports Grafana 7, and has dropped support for versions older than 7.

* the `nodeResources()` function has been enhanced to support
  displaying the resource label (Issue [HELM-95](https://issues.opennms.org/browse/HELM-95))
* the Filter and Alarm Table panels have been updated to work with Grafana 7 (Issue [HELM-247](https://issues.opennms.org/browse/HELM-247))

### v5.0.3

This release does not yet fix Grafana 7 support (it's complicated...) but it fixes a few more bugs while
we work on Grafana 7 support.

Also note, the docs that used to be included in the archive are now published at https://docs.opennms.com/ -- our
future home for all OpenNMS documentation.

* Make Helm docs publicly available (Issue [HELM-221](http://issues.opennms.org/browse/HELM-221))
* "How to configure the data sources in Grafana" docs are missing (Issue [HELM-231](http://issues.opennms.org/browse/HELM-231))
* Enhance HELM documentation (Issue [HELM-240](http://issues.opennms.org/browse/HELM-240))
* Add expression examples (Issue [HELM-241](http://issues.opennms.org/browse/HELM-241))
* JEXL expressions (Issue [HELM-242](http://issues.opennms.org/browse/HELM-242))
* Cannot see list of nodes and resources when editing a panel. (Issue [HELM-243](http://issues.opennms.org/browse/HELM-243))
* update requirements (Issue [HELM-251](http://issues.opennms.org/browse/HELM-251))

### v5.0.2

This release contains significant documentation updates, as well as a few bug fixes including Grafana 6.7 support.
It also bumps the Grafana provided by our Docker images to `6.7.2`.

* Document how to use the filter panel (Issue [HELM-206](http://issues.opennms.org/browse/HELM-206))
* Document how to use the entity data-source (Issue [HELM-207](http://issues.opennms.org/browse/HELM-207))
* Publish build artifacts with CircleCI to Cloudsmith (Issue [HELM-214](http://issues.opennms.org/browse/HELM-214))
* Convert docs from Asciibinder to Antora (Issue [HELM-217](http://issues.opennms.org/browse/HELM-217))
* Integrate Antora documentation into CircleCI (Issue [HELM-218](http://issues.opennms.org/browse/HELM-218))
* Sign RPM and DEB packages with GPG key (Issue [HELM-222](http://issues.opennms.org/browse/HELM-222))
* Some filter could be documented (Issue [HELM-227](http://issues.opennms.org/browse/HELM-227))
* Cannot add an Alarm Table widget when using Grafana 6.6.x (Issue [HELM-229](http://issues.opennms.org/browse/HELM-229))
* Support Grafana 6.7.x for our Helm plugin (Issue [HELM-232](http://issues.opennms.org/browse/HELM-232))

### v5.0.1

This small release works around a module-loading bug in some Grafana versions.
It also bumps the Grafana provided by our Docker images to `6.6.1`.

### v5.0.0

This release fixes a number of issues, most notably compatibility with newer Grafana releases.
These fixes necessitated dropping compatibility with Grafana versions older than 6.3, so we have bumped the major version of Helm to 5.

Additionally, documentation has been improved and a number of behind-the-scenes changes have been made related to continuous integration and build system.

* [HELM-64: Node search allows only to select the first 25 nodes](https://issues.opennms.org/browse/HELM-64)
* [HELM-196: Alarm table rendering failures with Grafana 6.5.2](https://issues.opennms.org/browse/HELM-196)
* [HELM-201: Panel Refreshes After Each Request When Clearing Multiple Alarms](https://issues.opennms.org/browse/HELM-201)
* [HELM-202: Alarms details modal shows wrong alarm when table is sorted](https://issues.opennms.org/browse/HELM-202)
* [HELM-208: Error appears when selecting filter type](https://issues.opennms.org/browse/HELM-208)
* [HELM-212: number (count) columns render wrong in Grafana 6.5 and 6.6](https://issues.opennms.org/browse/HELM-212)

### v4.0.2

This release fixes a bug with the Flow datasource and Grafana 6.4, as well as some other cosmetic changes to the Flow query interface.

* [HELM-190: TypeError: Cannot read property 'toBits' of undefined](https://issues.opennms.org/browse/HELM-190)
* [HELM-192: Rendering Bug in Flow Query Builder](https://issues.opennms.org/browse/HELM-192)
* [HELM-193: Conversation Flow Histogram show "null" instead of Unknown/Other in legend](https://issues.opennms.org/browse/HELM-193)

### v4.0.1

This is a small revision to 4.0.0 which contains dependency updates and a [fix for running under Grafana 6.4](https://issues.opennms.org/browse/JS-45).

### v4.0.0

#### General

Helm 4 now requires Grafana 6.0 or higher.

#### Entities Data Source

The Fault Management Data Source is now the Entities Data Source.

In addition to querying alarms, it can now query nodes as well.
This is useful for filtering in variables, or can be used for just viewing and filtering nodes from within Grafana.

This is a breaking change that will require you to convert existing dashboards to use the new plugin.
For details on upgrading, see [the Helm documentation](http://docs.opennms.org/helm/releases/latest/helm/latest/installation/upgrading.html).

#### Flow Data Source

* Enhancements have been made to support Horizon 25's addition of "top N" queries for conversations, hosts, and applicattions.

#### Filter Panel

A new panel has been added that allows you to configure a series of variables to put in a dashboard.
This panel coordinates with any panels in the dashboard using the Entities Data Source to automatically apply filters matching those variables.

In the future this will be enhanced to do more complicated set operations than are possible using the built-in datasource variables.

#### Alarm Table

* Alarm table code has been sync'd with enhancements from the upstream Grafana table panel.
* The new default columns and formatting for the alarm table have been updated to be more useful.
* It is now possible to configure the alarm table to not automatically refresh when new data is updated if you have navigated away from the first page of the list. When new data arrives in the background, a refresh icon will appear in the page bar.
* String-based columns (like log message) now get a mouseover with the full text of the column.
* Severity columns have been enhanced, including basic support for themes.
* A new column type (`checkbox`) has been added that will render a boolean value as either a checkmark or empty string.
* Support has been added to tag a specific alarm as the "root cause" in a situation when providing feedback in the Alarm Details screen.
* A number of UI cleanups have been made to the Alarm Details screen, fixing word wrapping, resizing when the browser is resized, and more.
* The alarm table can now export CSV and Excel files.  Go to `<panel title>` -> `More...` -> `Export CSV` or `Export Excel`.

### v3.0.1

* Updated a ton of dependencies, there are now 0 warnings from `yarn audit` ([HELM-138](https://issues.opennms.org/browse/HELM-138))
* Fixes for running under Grafana 6 ([HELM-132](https://issues.opennms.org/browse/HELM-132))
* A fix for parsing nested parentheses when using label formatters ([HELM-131](https://issues.opennms.org/browse/HELM-131))
* Fixed relative date formatter initialization ([HELM-134](https://issues.opennms.org/browse/HELM-134)) (Thanks,  Brynjar!)
* Includes bug fixes from [OpenNMS.js v1.3.1](https://github.com/OpenNMS/opennms-js/releases/tag/v1.3.1)

### v3.0.0

#### General

* Improved error messages for incomplete or invalid queries

#### Performance Data Source

* Added support for overriding time intervals and max datapoints
* Labels are now shown in the order they were queried
* Labels can now be formatted using transformation functions like
  `nodeToLabel(<foreignSource:foreignId>)` and `resourceToName(<resourceId>)`
  (Horizon 24 or greater)
* Measurements API requests are now made in `relaxed` mode (if the server
  is missing a particular requested attribute, all others are still returned)

#### Flow Data Source

* Added additional transforms for flow data (`toBits`, `onlyIngress`, `onlyEgress`)
* The Flow Deep Dive dashboard axis labels have been updated to be more intuitive

#### Fault Management Data Source

* Sorting by numeric columns now works as expected
* HTML alarm (event) log messages are now rendered properly
* Alarm multi-select and deselect now works as expected
* "Severity" in the Alarm Table panel is now a normal column, rather than a "Severity icons" check
  box in the config options -- existing configs should be automatically upgraded
* Added support for reordering columns in the Alarm Table panel
* Added support for Situations (correlated alarms), including sending feedback on
  alarm correlations (Horizon 23 or greater)
* Added limited support for multi-select dashboard variables in the Alarm Table panel
* Added a custom `node` attribute in the Alarm Table panel that supports node criteria
  (either passing a `nodeId` or `foreignSource:foreignId` tuple)
* Many enhancements were made to the Alarm Detail view
  (full raw response viewing, related alarms, etc.)
* It is now possible to display dates as a relative time in the Alarm Table panel

### v2.0.0

* Added a new datasource for querying flow data from OpenNMS
* Added support for "fallback" attributes to the performance datasource
* Added the ability to configure query timeouts for all of the datasources
* Require Grafana 5.x or greater

### v1.1.0

* Added support for custom actions in the Alarm Table panel
* Added the operator instructions field to the alarm details modal
* Updated the package dependencies to support Grafana 5.x
* Fixed a bug where long alarm descriptions and log messages would fill the alarm details modal
* Use consistent colors in both the Alarm Table and Alarm Histogram panels

### v1.0.0

* Initial release
