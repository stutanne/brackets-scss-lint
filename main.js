/*global define: false, brackets: false, $: false*/
define(function (require, exports, module) {
    "use strict";

    var CodeInspection  = brackets.getModule("language/CodeInspection"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        NodeDomain      = brackets.getModule("utils/NodeDomain"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        prefs = PreferencesManager.getExtensionPrefs("scsslint"),
        gemDir = prefs.get("gemDir") || "",
        maxExecBuffer = prefs.get("maxExecBuffer") || 200 * 1024,
        scssDomain      = new NodeDomain("scss", ExtensionUtils.getModulePath(module, "node/ScssDomain"));

    /**
     * Asynchronous linting entry point.
     *
     * @param {string} text File contents.
     * @param {string} fullPath Absolute path to the file.
     *
     * @return {$.Promise} Promise to return results of code inspection.
     */
    function handleHinterAsync(text, fullPath) {
        var projectRoot = ProjectManager.getProjectRoot().fullPath,
            def = new $.Deferred(),
            configFile = projectRoot + ".scss-lint.yml";

            FileSystem.resolve(configFile, function(err) {
                if (err !== null) {
                    configFile = null;
                }

                scssDomain.exec("build", fullPath, projectRoot, configFile, gemDir, maxExecBuffer)
                    .fail(function (err) {
                        return def.reject(err);
                    })
                    .done(function (result) {
                        var json = JSON.parse(result),
                            filepath,
                            errors,
                            error,
                            i, len,
                            results = [],
                            severity;

                        // Get path (which happens to be the object key)
                        for (filepath in json) {
                            break;
                        }

                        if (filepath === undefined) {
                            return def.resolve(null);
                        }

                        errors = json[filepath];

                        for (i = 0, len = errors.length; i < len; i += 1) {
                            error = errors[i];
                            severity = (error.severity === "warning") ? CodeInspection.Type.WARNING : CodeInspection.Type.ERROR;

                            results.push({
                                pos: {
                                    line: error.line - 1,
                                    ch: error.column - 1
                                },
                                message: error.reason,
                                type: severity
                            });
                        }

                        return def.resolve({errors: results});
                    });
            });

        return def.promise();
    }

    CodeInspection.register("scss", {
        name: "SCSS Lint",
        scanFileAsync: handleHinterAsync
    });

});
