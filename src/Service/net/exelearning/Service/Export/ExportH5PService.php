<?php

namespace App\Service\net\exelearning\Service\Export;

use App\Constants;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class ExportH5PService implements ExportServiceInterface
{
    private string $exportType;
    private FileHelper $fileHelper;
    private CurrentOdeUsersServiceInterface $currentOdeUsersService;
    private TranslatorInterface $translator;

    public function __construct(
        FileHelper $fileHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        TranslatorInterface $translator,
    ) {
        $this->exportType = Constants::EXPORT_TYPE_H5P;
        $this->fileHelper = $fileHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->translator = $translator;
    }

    public function generateExportFiles(
        $user,
        $odeSessionId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $libsResourcesPath,
        $odeComponentsSyncCloneArray,
        $idevicesMapping,
        $idevicesByPage,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $elpFileName,
        $resourcesPrefix,
        $isPreview,
        $translator,
    ) {
        $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $user);
        $contentDir = $exportDirPath.'content'.DIRECTORY_SEPARATOR;
        if (!is_dir($contentDir)) {
            mkdir($contentDir, 0775, true);
        }

        $projectTitle = isset($odeProperties['pp_title'])
            ? trim(strip_tags($odeProperties['pp_title']->getValue()))
            : 'eXeLearning project';
        $language = isset($odeProperties['pp_lang'])
            ? substr($odeProperties['pp_lang']->getValue(), 0, 2)
            : 'en';

        $html = '';
        foreach ($odeNavStructureSyncs as $page) {
            $pageId = $page->getOdePageId();
            $pageData = $pagesFileData[$pageId];
            $html .= '<h2>'.htmlspecialchars($pageData['name']).'</h2>';
            foreach ($pageData['blocks'] as $block) {
                foreach ($block['idevices'] as $idevice) {
                    if (!empty($idevice['htmlView'])) {
                        $html .= $idevice['htmlView'];
                    }
                }
            }
        }

        $content = ['text' => $html];
        file_put_contents(
            $contentDir.'content.json',
            json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        $libraryJson = [
            'title' => 'SimpleHtml',
            'machineName' => 'H5P.SimpleHtml',
            'majorVersion' => 1,
            'minorVersion' => 0,
            'patchVersion' => 0,
            'runnable' => 1,
            'embedTypes' => ['div'],
            'preloadedJs' => [
                ['path' => 'simple-html.js'],
            ],
            'preloadedCss' => [],
        ];

        $folderName = \H5PCore::libraryToFolderName($libraryJson);
        $libraryDir = $exportDirPath.$folderName.DIRECTORY_SEPARATOR;
        if (!is_dir($libraryDir)) {
            mkdir($libraryDir, 0775, true);
        }
        file_put_contents(
            $libraryDir.'library.json',
            json_encode($libraryJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        $semantics = [
            [
                'name' => 'text',
                'type' => 'text',
                'widget' => 'html',
                'label' => 'Text',
            ],
        ];
        file_put_contents(
            $libraryDir.'semantics.json',
            json_encode($semantics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        $js = <<<'JS'
H5P.SimpleHtml = (function () {
  function SimpleHtml(params) {
    this.text = params.text || '';
  }

  SimpleHtml.prototype.attach = function (container) {
    container.innerHTML = this.text;
  };

  return SimpleHtml;
})();
JS;
        file_put_contents($libraryDir.'simple-html.js', $js);

        $h5pJson = [
            'title' => $projectTitle,
            'language' => $language,
            'mainLibrary' => 'H5P.SimpleHtml',
            'embedTypes' => ['div'],
            'preloadedDependencies' => [
                [
                    'machineName' => 'H5P.SimpleHtml',
                    'majorVersion' => 1,
                    'minorVersion' => 0,
                ],
            ],
        ];
        file_put_contents(
            $exportDirPath.'h5p.json',
            json_encode($h5pJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return true;
    }
}
