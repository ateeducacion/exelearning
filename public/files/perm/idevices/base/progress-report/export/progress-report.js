/**
 * Evaluation activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeInforme = {
    idevicePath: "",
    options: {},
    isInExe: false,
    data: null,
    menusNav: [],
    init: function () {
        this.isInExe = eXe.app.isInExe();

        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath("progress-report")
            : this.idevicePath = $('.idevice_node.progress-report').eq(0).attr('data-idevice-path');

        this.activities = $(".informe-IDevice");

        if (this.activities.length == 0) {
            $(".informe-IDevice").hide();
            return;
        }

        if (!$exeDevices.iDevice.gamification.helpers.supportedBrowser("informe")) return;

        if ($("#exe-submitButton").length > 0) {
            this.activities.hide();
            if (typeof _ != "undefined") this.activities.before("<p>" + _("Progress report") + "</p>");
            return;
        }
        this.enable()
    },

    enable: function () {
        $eXeInforme.loadGame();
    },

    loadGame: function () {
        $eXeInforme.options = {};
        $eXeInforme.activities.each(function (i) {
            if (i == 0) {
                const dl = $(".informe-DataGame", this),
                    mOption = $eXeInforme.loadDataGame(dl);
                $eXeInforme.options = mOption;
                const informe = $eXeInforme.createInterfaceinforme();
                dl.before(informe).remove();
                $eXeInforme.createTableIdevices();
                $eXeInforme.updatePages();
                $eXeInforme.applyTypeShow(mOption.typeshow);
                $eXeInforme.addEvents();
            }
        });
    },

    loadDataGame(data) {
        const json = data.text(),
            mOptions = $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            currentURL = window.location.href,
            isExportPath = currentURL.includes('/tmp/user/export');

        mOptions.activeLinks = isExportPath || this.isInExe || $('body').hasClass('exe-scorm') || typeof mOptions.activeLinks == 'undefined'
            ? false
            : mOptions.activeLinks;

        return mOptions;
    },


    getURLPage: function (pageId) {
        if (!pageId) return '';

        const url = new URL(window.location.href);

        let base = url.pathname.replace(/\/html(\/.*)?$/i, '');
        base = base.replace(/\/$/, '');

        if (pageId === 'index') {
            url.pathname = `${base}/index.html`;
        } else {
            url.pathname = `${base}/html/${pageId}.html`;
        }

        return url.toString();
    },

    createInterfaceinforme: function () {
        const msgs = $eXeInforme.options.msgs;
        const download = msgs.msgDownload || 'Descargar informe de progreso'
        const localmod = msgs.msgLocalMode || 'En modo local, los resultados de las actividades realizadas no se pueden mostrar en el informe'
        const html = `<div class="IFPP-MainContainer" >
                        <p id="informeNotLocal" style="display:none">${localmod}<p>
                        <div class="IFPP-GameContainer" id="informeGameContainer">
                            <div id="informeData" class="IFPP-Data" ></div>
                        </div>
                            <a id="informeDownloadLink" href="#" download="imagen.jpg" style="display: none;">${download}</a>
                        </div>
                    </div>`;
        return html;
    },

    normalizeFileName: function (fileName) {
        const replacements = {
            'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'ae', 'å': 'aa', 'æ': 'ae',
            'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'ee',
            'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
            'ð': 'dh', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
            'ö': 'oe', 'ø': 'oe', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'ue',
            'ý': 'y', 'þ': 'th', 'ÿ': 'y', 'ā': 'aa', 'ă': 'a', 'ą': 'a',
            'ć': 'c', 'ĉ': 'c', 'ċ': 'c', 'č': 'ch', 'ď': 'd', 'đ': 'd',
            'ē': 'ee', 'ĕ': 'e', 'ė': 'e', 'ę': 'e', 'ě': 'e',
            'ĝ': 'g', 'ğ': 'g', 'ġ': 'g', 'ģ': 'g',
            'ĥ': 'h', 'ħ': 'hh',
            'ĩ': 'i', 'ī': 'ii', 'ĭ': 'i', 'į': 'i', 'ı': 'i', 'ĳ': 'ij',
            'ĵ': 'j', 'ķ': 'k', 'ĸ': 'k',
            'ĺ': 'l', 'ļ': 'l', 'ľ': 'l', 'ŀ': 'l', 'ł': 'l',
            'ń': 'n', 'ņ': 'n', 'ň': 'n', 'ŉ': 'n', 'ŋ': 'ng',
            'ō': 'oo', 'ŏ': 'o', 'ő': 'oe', 'œ': 'oe',
            'ŕ': 'r', 'ŗ': 'r', 'ř': 'r',
            'ś': 's', 'ŝ': 's', 'ş': 's', 'š': 'sh',
            'ţ': 't', 'ť': 't', 'ŧ': 'th',
            'ũ': 'u', 'ū': 'uu', 'ŭ': 'u', 'ů': 'u', 'ű': 'ue', 'ų': 'u',
            'ŵ': 'w', 'ŷ': 'y',
            'ź': 'z', 'ż': 'z', 'ž': 'zh',
            'ſ': 's', 'ǝ': 'e',
            'ș': 's', 'ț': 't',
            'ơ': 'o', 'ư': 'u',
            'ầ': 'a', 'ằ': 'a', 'ề': 'e', 'ồ': 'o', 'ờ': 'o', 'ừ': 'u', 'ỳ': 'y',
            'ả': 'a', 'ẩ': 'a', 'ẳ': 'a', 'ẻ': 'e', 'ể': 'e', 'ỉ': 'i', 'ỏ': 'o',
            'ổ': 'o', 'ở': 'o', 'ủ': 'u', 'ử': 'u', 'ỷ': 'y',
            'ẫ': 'a', 'ẵ': 'a', 'ẽ': 'e', 'ễ': 'e', 'ỗ': 'o', 'ỡ': 'o', 'ữ': 'u', 'ỹ': 'y',
            'ấ': 'a', 'ắ': 'a', 'ế': 'e', 'ố': 'o', 'ớ': 'o', 'ứ': 'u',
            'ạ': 'a', 'ậ': 'a', 'ặ': 'a', 'ẹ': 'e', 'ệ': 'e', 'ị': 'i', 'ọ': 'o',
            'ộ': 'o', 'ợ': 'o', 'ụ': 'u', 'ự': 'u', 'ỵ': 'y',
            'ɑ': 'a', 'ǖ': 'uu', 'ǘ': 'uu', 'ǎ': 'a', 'ǐ': 'i', 'ǒ': 'o', 'ǔ': 'u', 'ǚ': 'uu', 'ǜ': 'uu',
            '&': '-'
        };

        const escapeRegex = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const replacerPattern = new RegExp(
            Object.keys(replacements).map(escapeRegex).join('|'),
            'g'
        );
        const specialPattern = /[¨`@^+¿?\[\]\/\\=<>:;,'"#$*()|~!{}%’«»”“]/g;
        const controlPattern = /[\x00-\x1F\x7F]/g;
        const underscorePattern = /_+/g;
        const dashDotPattern = /[.\-]+/g;
        const trimPattern = /^[.\-]+|[.\-]+$/g;
        if (typeof fileName !== 'string') return '';

        return fileName
            .toLowerCase()
            .replace(replacerPattern, m => replacements[m])
            .replace(specialPattern, '')
            .replace(/ /g, '-')
            .replace(underscorePattern, '_')
            .replace(controlPattern, '')
            .replace(dashDotPattern, '-')
            .replace(trimPattern, '');

    },

    generateHtmlFromPages: function (pages) {
        let html = '<ul id="informePagesContainer">';
        let pn = true;
        let pageId = '';
        pages.forEach(page => {
            if (pn && (typeof page.parentID == "undefined" || page.parentID == null)) {
                pageId = 'index';
                pn = false;
            } else {
                pageId = page.id
            }
            let pageHtml = `<li class="IFPP-PageItem" data-page-id="${pageId}">`
            pageHtml += `<div class="IFPP-PageTitleDiv">
                            <div class="IFPP-PageIcon"></div>
                            <div class="IFPP-PageTitle">${page.title}</div>
                        </div>`;
            let componentsHtml = '';

            if (page.components && page.components.length > 0) {

                componentsHtml += '<ul class="IFPP-Components">';
                page.components.forEach(component => {
                    const surl = $eXeInforme.isInExe || !page.title ? '' : $eXeInforme.getURLPage(page.url) + `#${component.ideviceID}`;
                    const isEvaluable = component.evaluationID && $eXeInforme.options.evaluationID && $eXeInforme.options.evaluationID == component.evaluationID;
                    const iconClass = isEvaluable ? 'IFPP-IdiviceIcon' : 'IFPP-IdiviceIconNo';
                    const componentScore = isEvaluable
                        ? `<div class="IFPP-ComponentDateScore">
                                <div class="IFPP-ComponentDate"></div>
                                <div class="IFPP-ComponentScore" style="text-align:right:min-width:1em"></div>
                            </div>`
                        : '';
                    const typeIdevice = $eXeInforme.options.showTypeGame
                        ? `<div id="informeType">(${component.odeIdeviceTypeName})</div>`
                        : '';

                    const inWeb =
                        !$eXeInforme.isInExe &&
                        location.protocol !== 'file:' &&
                        typeof window.API === 'undefined' &&
                        typeof window.API_1484_11 === 'undefined' &&
                        Boolean($eXeInforme.options?.activeLinks) &&
                        Boolean(isEvaluable) &&
                        typeof surl === 'string' && surl.length > 4;

                    const showLinks = inWeb
                        ? `<div class="IFPP-PageTitleDiv">
                                <a href="#" class="IFPP-PageTitleDiv IFPP-IdeviceLink" data-page-id="${surl}" data-idevice-id="${component.ideviceID}" title="${$eXeInforme.options.msgs.msgSeeActivity}">
                                    <div class="IFPP-Icon ${iconClass}"></div>
                                    <div class="IFPP-ComponentTitle">${component.blockName || ''}</div>
                                </a>
                                ${typeIdevice}
                            </div>`
                        : `<div class="IFPP-PageTitleDiv">
                                <div class="IFPP-Icon ${iconClass}"></div>
                                <div class="IFPP-ComponentTitle">${component.blockName || ''}</div>
                                ${typeIdevice}
                            </div>`;
                    componentsHtml += `<li class="IFPP-ComponentItem" data-component-id="${component.ideviceID}" data-is-evaluable="${isEvaluable}">
                                            <div class="IFPP-ComponentData">
                                                ${showLinks}
                                            </div>
                                            ${componentScore}
                                        </li>`

                });
                componentsHtml += '</ul>';
            }

            let childrenHtml = '';
            if (page.children && page.children.length > 0) {
                childrenHtml = $eXeInforme.generateHtmlFromPages(page.children);
            }

            pageHtml += componentsHtml;
            pageHtml += childrenHtml;
            pageHtml += '</li>';

            html += pageHtml;
        });
        html += '</ul>';

        $('#informeEvalutationNumber').html($eXeInforme.options.msgs.msgNoPendientes.replace("%s", $eXeInforme.options.number));

        return html;
    },

    applyTypeShow: function (typeshow) {
        const $gameContainer = $('#informePagesContainer');
        if (typeshow == 1) {
            $gameContainer.find('.IFPP-ComponentItem').each(function () {
                const isEvaluable = $(this).data('is-evaluable');
                if (!isEvaluable) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            });
            $gameContainer.find('.IFPP-PageItem').show();
        } else if (typeshow == 2) {
            $gameContainer.find('.IFPP-ComponentItem').each(function () {
                const isEvaluable = $(this).data('is-evaluable');
                if (!isEvaluable) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            });

            function processPageItem($pageItem) {
                let hasVisibleEvaluableComponents = $pageItem.find('> ul.IFPP-Components > .IFPP-ComponentItem:visible').length > 0;

                $pageItem.find('> ul > .IFPP-PageItem').each(function () {
                    const childHasEvaluable = processPageItem($(this));
                    hasVisibleEvaluableComponents = hasVisibleEvaluableComponents || childHasEvaluable;
                });

                if (hasVisibleEvaluableComponents) {
                    $pageItem.show();
                } else {
                    $pageItem.hide();
                }

                return hasVisibleEvaluableComponents;
            }

            $gameContainer.children('.IFPP-PageItem').each(function () {
                processPageItem($(this));
            });

        } else {
            $gameContainer.find('.IFPP-ComponentItem').show();
            $gameContainer.find('.IFPP-PageItem').show();
        }
    },

    formatNumber: function (num) {
        if (typeof num !== 'number' || isNaN(num)) return 0;
        return Number.isInteger(num) ? num : num.toFixed(2);
    },

    updatePages: function () {
        let completed = 0;
        let score = 0;
        let date = '';
        const id = $eXeInforme.options.evaluationID;
        const data = $eXeInforme.getDataStorage(id);

        if (data) {
            data.forEach(idevice => {
                let $idevice = $('#informeGameContainer').find(`.IFPP-ComponentItem[data-component-id="${idevice.id}"]`);
                if ($idevice.length === 1) {
                    completed++;
                    let sp = parseFloat(idevice.score) || 0;
                    score += sp;
                    date = idevice.date;
                    $idevice.find('.IFPP-ComponentDate').text(date)
                    $idevice.find('.IFPP-ComponentScore').text($eXeInforme.formatNumber(sp))

                    let bgc = sp < 5 ? "#B61E1E" : "#007F5F";
                    let icon = sp < 5 ? "IFPP-IdiviceIconFail" : "IFPP-IdiviceIconPass";
                    $idevice.find('.IFPP-Icon')
                        .removeClass("IFPP-IdiviceIconFail IFPP-IdiviceIconPass IFPP-IdiviceIcon")
                        .addClass(icon);
                    $idevice.find('.IFPP-ComponentScore').css({ 'color': bgc });
                }

            })
        }

        let scorepartial = completed > 0 ? (score / completed) : 0;
        scorepartial = $eXeInforme.formatNumber(scorepartial)

        let scoretotal = (score / $eXeInforme.options.number);
        scoretotal = $eXeInforme.formatNumber(scoretotal)

        let bgc = scoretotal < 5 ? "#B61E1E" : "#007F5F";
        $('#informeTotalActivities').text($eXeInforme.options.msgs.mssActivitiesNumber.replace("%s", $eXeInforme.options.number))
        $('#informeCompletedActivities').text($eXeInforme.options.msgs.msgActivitiesCompleted.replace("%s", completed))

        $('#informeTotalScore').text($eXeInforme.options.msgs.msgAverageScore1.replace("%s", scoretotal))
        $('#informeTotalScoreA').text($eXeInforme.options.msgs.msgAverageScoreCompleted.replace("%s", scorepartial))

        $('#informeScoretTotal').text(scoretotal);
        $('#informeScoreBar').css({ 'background-color': bgc });

    },

    createPagesHtml: function () {
        let pages = $eXeInforme.options.msgs.msgReload || 'Edita este idevice para actualizar sus contenidos';
        if ($eXeInforme.options.sessionIdevices) {
            pages = $eXeInforme.generateHtmlFromPages($eXeInforme.options.sessionIdevices);
        }
        return pages;
    },

    createTableIdevices: function () {
        let userDisplay = $eXeInforme.options.userData ? "flex" : "none"
        let table = `
            <div class="IFPP-Table" id="informeTable">
                <div id="informeTitleProyect" class="IFPP-Title">
                    ${$eXeInforme.options.msgs.msgReportTitle}
                </div>
                <div id="informeUserData" class="IFPP-UserData" style="display:${userDisplay};">
                    <div id="informeUserNameDiv" class="IFPP-UserName">
                        <label for="informeUserName">${$eXeInforme.options.msgs.msgName}: </label>
                        <input type="text" id="informeUserName">
                    </div>
                    <div id="informeUserDateDiv" class="IFPP-UserDate">
                        <label for="informeUserDate">${$eXeInforme.options.msgs.msgDate}: </label>
                        <input type="text" id="informeUserDate" disabled>
                    </div>
                </div>
                <div class="IFPP-Header">
                    <div id="informeTotalActivities"></div>
                    <div id="informeCompletedActivities"></div>
                    <div id="informeTotalScoreA"></div>
                    <div id="informeTotalScore"></div>
                </div>
                <div id="informePlusDiv" class="IFPP-Plus">
                    <div>${$eXeInforme.options.msgs.mgsSections}:</div>
                        <div class="IFPP-PagesContainer">${$eXeInforme.createPagesHtml()}</div>
                        <div id="informeScoreBar"class="IFPP-GameScore">
                            <div>${$eXeInforme.options.msgs.msgAverageScore}</div>
                            <div id="informeScoretTotal"></div>
                        </div>
                    </div>
                    <div id="informeButtons" class="IFPP-LinksInforme" style="background-color:white; text-align:right">
                        <a id="informeReboot" href="#">${$eXeInforme.options.msgs.msgReboot}</a>
                        <a id="informeCapture" href="#">${$eXeInforme.options.msgs.msgSave}</a>
                    </div>
                </div>`

        $("#informeData").empty();
        $("#informeData").append(table);
        $("#informeUserDate").val($eXeInforme.getDateNow());
    },

    getDataStorage: function (id) {
        let data = $exeDevices.iDevice.gamification.helpers.isJsonString(localStorage.getItem("dataEvaluation-" + id));
        return data.activities;
    },

    addEvents: function () {
        $("#informeGameContainer").on("click", "#informeLinkPlus", function (e) {
            e.preventDefault();
            $("#informePlusDiv").slideToggle();
        });

        $("#informeGameContainer").on("click", "#informeReboot", function (e) {
            e.preventDefault();
            if (confirm($eXeInforme.options.msgs.msgDelete)) {
                localStorage.removeItem(
                    "dataEvaluation-" + $eXeInforme.options.evaluationID
                );
                $eXeInforme.createTableIdevices();
                $eXeInforme.updatePages();
                $eXeInforme.applyTypeShow($eXeInforme.options.typeshow);
            }
        });

        $("#informeGameContainer").on("click", "#informeCapture", function (e) {
            e.preventDefault();
            $eXeInforme.saveReport();
        });

        $("#informeGameContainer").on("click", ".IFPP-IdeviceLink", function (e) {
            e.preventDefault();

            let url = $(this).data('page-id');
            let idevice = $(this).data('idevice-id');

            if (!url || !idevice) {
                console.error('Faltan los datos necesarios para generar la URL.');
                return;
            }
            localStorage.setItem('hashScrolled', idevice);
            try {
                window.location.href = url;
            } catch (error) {
                console.error('Error al intentar navegar a la URL:', error);
            }
        });
    },

    saveReport: function () {
        if ($eXeInforme.options.userData) {
            if ($('#informeUserName').val().trim() === "") {
                var msg = $eXeInforme.options.msgs.msgNotCompleted + ': ' + $eXeInforme.options.msgs.msgName;
                alert(msg);
                return;
            }
        }
        var divElement = document.getElementById("informeTable");
        if (!divElement) {
            console.error("No se encontró el elemento con el ID proporcionado.");
            return;
        }
        $("#informeButtons").hide();
        html2canvas(divElement)
            .then(function (canvas) {
                var imageData = canvas.toDataURL("image/png");
                var link = document.createElement("a");
                link.href = imageData;
                link.download = $eXeInforme.options.msgs.msgReport + ".png";
                link.click();
            })
            .catch(function (error) {
                $("#informeButtons").show();
                console.error("Error al generar la captura: ", error);
            });
        $("#informeButtons").show();
    },

    showMessage: function (type, message) {
        var colors = [
            "#555555",
            $eXeInforme.borderColors.red,
            $eXeInforme.borderColors.green,
            $eXeInforme.borderColors.blue,
            $eXeInforme.borderColors.yellow,
        ],
            color = colors[type];
        $("#informePAuthor-" + instance).text(message);
        $("#informePAuthor-" + instance).css({
            color: color,
        });
    },


    getDateNow: function () {
        var dateNow = new Date();
        var dia = $eXeInforme.addZero(dateNow.getDate());
        var mes = $eXeInforme.addZero(dateNow.getMonth() + 1);
        var anio = dateNow.getFullYear();
        var hora = $eXeInforme.addZero(dateNow.getHours());
        var minutos = $eXeInforme.addZero(dateNow.getMinutes());
        var segundos = $eXeInforme.addZero(dateNow.getSeconds());

        return dia + "/" + mes + "/" + anio + " " + hora + ":" + minutos + ":" + segundos;
    },

    addZero: function (number) {
        return number < 10 ? "0" + number : number;
    }
};
$(function () {
    $eXeInforme.init();
});
