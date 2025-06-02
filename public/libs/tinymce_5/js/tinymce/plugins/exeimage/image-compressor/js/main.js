window.addEventListener('DOMContentLoaded', function () {
	var Vue = window.Vue;
	var URL = window.URL || window.webkitURL;
	var XMLHttpRequest = window.XMLHttpRequest;
	var Compressor = window.Compressor;

	new Vue({
		el: '#app',

		data: function () {
			var vm = this;

			return {
				options: {
					strict: true,
					checkOrientation: true,
					// maxWidth: eXeImageCompressor.sizeLimit,
					// maxHeight: eXeImageCompressor.sizeLimit,
					maxWidth: eXeImageCompressor.imgMaxSize,
					maxHeight: eXeImageCompressor.imgMaxSize,
					minWidth: 0,
					minHeight: 0,
					width: undefined,
					height: undefined,
					quality: 0.95,
					mimeType: '',
					convertSize: 5000000,
					success: function (result) {
						var reader = new FileReader();
						reader.readAsDataURL(result);
						reader.onloadend = function () {
							var base64data = reader.result;
							vm.outputURL = base64data;
						}
						// console.log('Output: ', result);

						if (URL) {
							vm.outputURL = URL.createObjectURL(result);
						}

						vm.output = result;
						// See #487 vm.$refs.input.value = '';
					},
					error: function (err) {
						window.alert(err.message);
					},
				},
				inputURL: '',
				outputURL: '',
				input: {},
				output: {},
			};
		},

		filters: {
			prettySize: function (size) {
				var kilobyte = 1024;
				var megabyte = kilobyte * kilobyte;

				if (size > megabyte) {
					return (size / megabyte).toFixed(2) + ' MB';
				} else if (size > kilobyte) {
					return (size / kilobyte).toFixed(2) + ' KB';
				} else if (size >= 0) {
					return size + ' B';
				}

				return 'N/A';
			},
		},

		methods: {
			compress: function (file) {
				if (!file) {
					return;
				}

				// console.log('Input: ', file);

				if (URL) {
					this.inputURL = URL.createObjectURL(file);
				}

				this.input = file;
				new Compressor(file, this.options);
			},

			change: function (e) {
				this.compress(e.target.files ? e.target.files[0] : null);
			},

			dragover: function (e) {
				e.preventDefault();
			},

			drop: function (e) {
				e.preventDefault();
				// eXeLearning
				jQuery("#inputSize").val("");
				jQuery("#inputMaxWidth").val(eXeImageCompressor.maxSize)[0].dispatchEvent(new Event('input'));
				jQuery("#inputMaxHeight").val(eXeImageCompressor.maxSize)[0].dispatchEvent(new Event('input'));
				// / eXeLearning
				this.compress(e.dataTransfer.files ? e.dataTransfer.files[0] : null);
			},
		},

		watch: {
			options: {
				deep: true,
				handler: function () {
					this.compress(this.input);
				},
			},
		},

		mounted: function () {
			if (!XMLHttpRequest) {
				return;
			}

			// eXeLearning
			// var name = "exelearning.png";
			// var url = "images/"+name;
			var originalSrc = top.imgCompressor.originalSrc;

			var ext = originalSrc.split('.').pop();
			ext = ext.toLowerCase();
			if (ext == "jpg" || ext == "jpeg" || originalSrc.indexOf("data:image/jpeg") == 0) jQuery("#inputQuality,label[for='inputQuality']").show();
			else jQuery("#inputQuality,label[for='inputQuality']").hide();

			var name = originalSrc.split("/").pop().split("_").pop();
			top.imgCompressor.fileToSave = name;
			var url = `../../../../../../../${originalSrc}`;
			if (originalSrc.indexOf("resources/") == 0) {
				var parts = originalSrc.split("/");
				parts = parts[1];
				if (parts != "") {
					url = top.window.location + "/" + originalSrc;
					name = parts;
					var backupWarning = $i18n.backupWarning;
					backupWarning = backupWarning.replace("$", '<a href="' + url + '" download="' + name + '">');
					backupWarning = backupWarning.replace("$", '</a>');
					$("#imageEditorBackupMessage").html(backupWarning);
					// Get the image size
					eXeImageCompressor.loadImage(url);
				}
			} else if (originalSrc.indexOf("/previews/") == 0) {
				top.eXe.app.alert($i18n.newImageWarning);
			} else {
				// Open the file picker
				jQuery("label[for='file']").trigger("click");
			}

			var vm = this;
			var xhr = new XMLHttpRequest();

			xhr.onload = function () {
				var blob = xhr.response;
				var date = new Date();

				blob.lastModified = date.getTime();
				blob.lastModifiedDate = date;
				blob.name = name;
				vm.compress(blob);
			};
			xhr.open('GET', url);
			xhr.responseType = 'blob';
			xhr.send();
		},
	});
});
// eXeLearning
var eXeImageCompressor = {
	type: "file", // base64 or file
	sizeLimit: 1200, // true max size
	maxSize: 1200, // default size
	setMaxSize: function () {
		var v = this.getCookie("eXeImageCompressorMaxSize");
		if (!isNaN(v) && v != "") {
			v = Math.round(v);
			if (v > 0 && v < this.sizeLimit) this.maxSize = v;
		}
	},
	firstImageLoaded: false,
	setCookie: function (cvalue) {
		var d = new Date();
		d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
		var expires = "expires=" + d.toUTCString();
		document.cookie = "eXeImageCompressorMaxSize=" + cvalue + ";" + expires + ";path=/;SameSite=Lax";
	},
	getCookie: function (cname) {
		var name = cname + "=";
		var decodedCookie = decodeURIComponent(document.cookie);
		var ca = decodedCookie.split(';');
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == ' ') c = c.substring(1);
			if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
		}
		return "";
	},
	loadImage: function (url) {
		var img = new Image();
		img.onload = function () {
			var w = this.width;
			var h = this.height;
			if (!isNaN(w) && !isNaN(h)) {
				var v = w;
				if (h > w) v = h;
				// if (v > eXeImageCompressor.sizeLimit) v = eXeImageCompressor.sizeLimit;
				if (v > eXeImageCompressor.imgMaxSize) v = eXeImageCompressor.imgMaxSize;
				if (eXeImageCompressor.firstImageLoaded == false && v >= eXeImageCompressor.maxSize) {
					v = eXeImageCompressor.maxSize;
					jQuery("#inputSize").val(v);
					jQuery("#inputMaxWidth").val(v)[0].dispatchEvent(new Event('input'));
					jQuery("#inputMaxHeight").val(v)[0].dispatchEvent(new Event('input'));
				}
				eXeImageCompressor.firstImageLoaded = true;
			}
		}
		img.src = url;
		var ext = url.split('.').pop();
		ext = ext.toLowerCase();
		if (ext == "jpg" || ext == "jpeg" || url.indexOf("data:image/jpeg") == 0) jQuery("#inputQuality,label[for='inputQuality']").show();
		else jQuery("#inputQuality,label[for='inputQuality']").hide();
	},
	init: function () {
		this.i18n();
		this.setMaxSize();
		this.imgMaxSize = "";
		if(parseInt(parent.document.querySelector("#width-dimension").value) >= parseInt(parent.document.querySelector("#height-dimension").value)){
			this.imgMaxSize = document.querySelector("#inputSize").value = parent.document.querySelector("#width-dimension").value;
		}else{
			this.imgMaxSize = document.querySelector("#inputSize").value = parent.document.querySelector("#height-dimension").value;
		}

		if(this.imgMaxSize > 1200){
			this.imgMaxSize = document.querySelector("#inputSize").value = 1200;
		}

		document.querySelector("#inputSize").max = this.imgMaxSize;
		document.querySelector("#inputSize").title = `1 - ${this.imgMaxSize}px`;

		setTimeout(function () {
			jQuery("#imageEditorOutputImg").on('load', function () {
				eXeImageCompressor.loadImage(this.src);
			});
			jQuery("#imageEditorSaveImg").fadeIn().click(function () {

				// Update the cookie
				var v = jQuery("#inputSize").val();
				// if (!isNaN(v) && v < eXeImageCompressor.sizeLimit) eXeImageCompressor.setCookie(v);
				if (!isNaN(v) && v < eXeImageCompressor.imgMaxSize) eXeImageCompressor.setCookie(v);

				var img = jQuery("#imageEditorOutputImg")
				var src = img.attr("src");

				// This will upload the image before inserting it in TinyMCE
				// You'll insert /previews/image_name.png instead of a Base64 image
				if (eXeImageCompressor.type == "file") {
					if (src.indexOf("data:image/") == 0) {
						var ext = src.replace("data:image/", "");
						ext = ext.split(";");
						ext = ext[0];
						if (ext != "") {
							ext = ext.toLowerCase();
							if (ext == "jpeg") ext = "jpg";
							if (ext == 'png' || ext == 'gif' || ext == 'jpg') {

								let base64data = document.getElementById("imageEditorOutputImg").getAttribute("src");

								top.eXe.app.uploadFile(base64data, top.imgCompressor.fileToSave).then(response => {
									if (response && response.savedPath && response.savedFilename) {
										let fullPath = `${response.savedPath}${response.savedFilename}`;
										let inputPath = parent.document.querySelector("div.tox-form__group input");
										inputPath.value = fullPath;

										let originalWidth = parent.document.querySelector("#width-dimension").value;
										let originalHeight = parent.document.querySelector("#height-dimension").value;

										let aspectRatio = originalWidth / originalHeight;

										let newsize = document.querySelector("#inputSize").value;

										if (aspectRatio > 1) {
											parent.document.querySelector("#width-dimension").value = newsize;
											parent.document.querySelector("#height-dimension").value = (newsize / aspectRatio).toFixed();
										}
										else if(aspectRatio < 1) {
											parent.document.querySelector("#height-dimension").value = newsize;
											parent.document.querySelector("#width-dimension").value = (newsize * aspectRatio).toFixed();
										}else{
											parent.document.querySelector("#height-dimension").value = parent.document.querySelector("#width-dimension").value = newsize;
										}

										let closeButton = parent.document.getElementsByClassName("tox-dialog tox-dialog--width-lg")[0].querySelector("BUTTON");
										closeButton.click();
									} else {
										top.eXe.app.alert(_("Error uploading image"));
									}
								})
								return false;
							}
						}
					}
				}

				// This will return a base64 image
				// previewTinyMCEimageDragDrop will do the rest
				// But it will always be a PNG image...
				var tmp = new Image();
				tmp.onload = function () {
					var width = this.width || "";
					var height = this.height || "";
					try {
						top.imgCompressor.callback(src + "?v=" + Date.now(), width, height);
					} catch (e) { }
				}
				tmp.src = src;
				return false;

			});
			jQuery("#inputSize").change(function () {
				var v = this.value;
				v = v.replace(/\D/g, '');
				// if (v > eXeImageCompressor.sizeLimit) v = v.slice(0, -1);
				if(v > eXeImageCompressor.imgMaxSize) v = eXeImageCompressor.imgMaxSize;
				this.value = v;
				jQuery("#inputMaxWidth").val(v)[0].dispatchEvent(new Event('input'));
				jQuery("#inputMaxHeight").val(v)[0].dispatchEvent(new Event('input'));
			});
		}, 1000);
	},
	i18n: function () {

		document.title = $i18n.imageOptimizer;
		var e = $("#imageEditorUploader p");
		var html = $i18n.uploadInstructions;
		html = html.replace("$", '<label for="file">');
		html = html.replace("$", '<input type="file" id="file" accept="image/*" class="sr-only"></label>');
		e.html(html)
		$("label[for='inputSize']").html($i18n.size + ":");
		$("label[for='inputMaxWidth']").html($i18n.maxWidth + ":");
		$("label[for='inputMaxHeight']").html($i18n.maxHeight + ":");
		$("label[for='inputWidth']").html($i18n.width + ":");
		$("label[for='inputHeight']").html($i18n.height + ":");
		$("label[for='inputQuality']").html($i18n.quality + ":");
		$("#imageEditorLabelName").html($i18n.name + ":");
		$("#imageEditorLabelOriginalSize").html($i18n.originalSize + ":");
		$("#imageEditorLabelResultSize").html($i18n.resultSize + ":");
		$("#imageEditorSaveImg").html($i18n.finish);

	},

	sendNewImagePath: function () {

	}
}
jQuery(function () {
	eXeImageCompressor.init();
});