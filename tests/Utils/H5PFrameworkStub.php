<?php
namespace App\Tests\Utils;

use H5PFrameworkInterface;

class H5PFrameworkStub implements H5PFrameworkInterface
{
    private string $h5pPath;
    private string $tmpDir;
    private array $errors = [];
    private array $infos = [];

    public function __construct(string $h5pPath)
    {
        $this->h5pPath = $h5pPath;
        $this->tmpDir = sys_get_temp_dir() . '/h5p_stub_' . uniqid();
        mkdir($this->tmpDir, 0777, true);
    }
    public function __destruct()
    {
        if (is_dir($this->tmpDir)) {
            foreach (scandir($this->tmpDir) as $f) {
                if ($f === '.' || $f === '..') continue;
                $p = $this->tmpDir . '/' . $f;
                if (is_dir($p)) { self::rrmdir($p); } else { unlink($p); }
            }
            rmdir($this->tmpDir);
        }
    }
    private static function rrmdir(string $dir): void
    {
        foreach (scandir($dir) as $f) {
            if ($f === '.' || $f === '..') continue;
            $p = $dir . '/' . $f;
            if (is_dir($p)) { self::rrmdir($p); } else { unlink($p); }
        }
        rmdir($dir);
    }

    public function getPlatformInfo() { return ['name'=>'phpunit','version'=>'1','h5pVersion'=>'1']; }
    public function fetchExternalData($url,$data=null,$blocking=null,$stream=null,$fullData=null,$headers=null,$files=null,$method=null) { return null; }
    public function setLibraryTutorialUrl($machineName,$tutorialUrl) {}
    public function setErrorMessage($message,$code=null) { $this->errors[] = $message; }
    public function setInfoMessage($message) { $this->infos[] = $message; }
    public function getMessages($type) { return $type === 'error' ? $this->errors : $this->infos; }
    public function t($message,$replacements=null) { return $message; }
    public function getLibraryFileUrl($libraryFolderName,$fileName) { return ''; }
    public function getUploadedH5pFolderPath() { return $this->tmpDir; }
    public function getUploadedH5pPath() { return $this->h5pPath; }
    public function loadAddons() { return []; }
    public function getLibraryConfig($libraries=null) { return []; }
    public function loadLibraries() { return []; }
    public function getAdminUrl() { return ''; }
    public function getLibraryId($machineName,$majorVersion=null,$minorVersion=null) { return false; }
    public function getWhitelist($isLibrary,$defaultContentWhitelist,$defaultLibraryWhitelist) { return $isLibrary ? $defaultLibraryWhitelist : $defaultContentWhitelist; }
    public function isPatchedLibrary($library) { return false; }
    public function isInDevMode() { return false; }
    public function mayUpdateLibraries() { return true; }
    public function saveLibraryData($libraryData,$new=null){}
    public function insertContent($content,$contentMainId=null){}
    public function updateContent($content,$contentMainId=null){}
    public function resetContentUserData($contentId){}
    public function saveLibraryDependencies($libraryId,$dependencies,$dependency_type){}
    public function copyLibraryUsage($contentId,$copyFromId,$contentMainId=null){}
    public function deleteContentData($contentId){}
    public function deleteLibraryUsage($contentId){}
    public function saveLibraryUsage($contentId,$librariesInUse){}
    public function getLibraryUsage($libraryId,$skipContent=null){ return ['content'=>0,'libraries'=>0]; }
    public function loadLibrary($machineName,$majorVersion,$minorVersion){ return null; }
    public function loadLibrarySemantics($machineName,$majorVersion,$minorVersion){ return null; }
    public function alterLibrarySemantics(&$semantics,$machineName,$majorVersion,$minorVersion){}
    public function deleteLibraryDependencies($libraryId){}
    public function lockDependencyStorage(){}
    public function unlockDependencyStorage(){}
    public function deleteLibrary($library){}
    public function loadContent($id){ return null; }
    public function loadContentDependencies($id,$type=null){ return []; }
    public function getOption($name,$default=null){ return $default; }
    public function setOption($name,$value){}
    public function updateContentFields($id,$fields){}
    public function clearFilteredParameters($library_ids){}
    public function getNumNotFiltered(){ return 0; }
    public function getNumContent($libraryId,$skip=null){ return 0; }
    public function isContentSlugAvailable($slug){ return true; }
    public function getLibraryStats($type){ return []; }
    public function getNumAuthors(){ return 0; }
    public function saveCachedAssets($key,$libraries){}
    public function deleteCachedAssets($library_id){ return []; }
    public function getLibraryContentCount(){ return 0; }
    public function afterExportCreated($content,$filename){}
    public function hasPermission($permission,$id=null){ return true; }
    public function replaceContentTypeCache($contentTypeCache){}
    public function libraryHasUpgrade($library){ return false; }
    public function replaceContentHubMetadataCache($metadata,$lang){}
    public function getContentHubMetadataCache($lang=null){ return null; }
    public function getContentHubMetadataChecked($lang=null){ return null; }
    public function setContentHubMetadataChecked($time,$lang=null){ return true; }
}
