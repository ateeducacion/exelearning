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

        $projectTitle = isset($odeProperties['pp_title']) ? strip_tags($odeProperties['pp_title']->getValue()) : 'eXeLearning project';
        $language = isset($odeProperties['pp_lang']) ? substr($odeProperties['pp_lang']->getValue(), 0, 10) : 'en';

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
        file_put_contents($contentDir.'content.json', json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $h5pJson = [
            'title' => $projectTitle,
            'language' => $language,
            'mainLibrary' => 'H5P.Text',
            'embedTypes' => ['iframe'],
            'preloadedDependencies' => [
                [
                    'machineName' => 'H5P.Text',
                    'majorVersion' => 1,
                    'minorVersion' => 1,
                ],
            ],
        ];
        file_put_contents($exportDirPath.'h5p.json', json_encode($h5pJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return true;
    }
}
