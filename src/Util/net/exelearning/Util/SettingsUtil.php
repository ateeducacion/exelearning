<?php

namespace App\Util\net\exelearning\Util;

use App\Constants;
use App\Settings;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * SettingsUtil.
 *
 * Utility functions for working with Settings
 */
class SettingsUtil
{
    private static ?ContainerInterface $container = null;

    /**
     * Sets the container.
     */
    public static function setContainer(ContainerInterface $container): void
    {
        self::$container = $container;
    }

    /**
     * Retrieves a parameter from the container.
     */
    public static function getParameter(string $parameter)
    {
        if (null === self::$container) {
            throw new \LogicException('Container is not set. You need to call SettingsUtil::setContainer() before accessing parameters.');
        }

        return self::$container->getParameter($parameter);
    }

    /**
     * Checks if installation type is online.
     */
    public static function installationTypeIsOnline(): bool
    {
        return boolval(self::getParameter('app.online_mode')); // Assuming '1' represents online mode
    }

    /**
     * Checks if installation type is offline.
     */
    public static function installationTypeIsOffline(): bool
    {
        return !self::installationTypeIsOnline(); // Assuming 0 represents offline
    }

    /**
     * Converts USER_STORAGE_MAX_DISK_SPACE from MB to Bytes.
     */
    public static function getUserStorageMaxDiskSpaceInBytes(): float
    {
        $factor = 2;

        if (self::installationTypeIsOffline()) {
            return Constants::INSTALLATION_TYPE_OFFLINE_DEFAULT_DISK_SPACE;
        } else {
            return Settings::USER_STORAGE_MAX_DISK_SPACE * pow(1024, $factor);
        }
    }

    /**
     * Converts FILE_UPLOAD_MAX_SIZE from MB to Bytes.
     *
     * @return float
     */
    public static function getFileMaxUploadSizeInBytes()
    {
        $factor = 2;

        if (self::installationTypeIsOffline()) {
            return Constants::INSTALLATION_TYPE_OFFLINE_DEFAULT_DISK_SPACE;
        } else {
            return Settings::FILE_UPLOAD_MAX_SIZE * pow(1024, $factor);
        }
    }

    /**
     * Get platform json structures.
     */
    public static function getPlatformJsonStructure()
    {
        $platform = self::setPlatform();
        if (!empty($platform)) {
            switch ($platform['api']) {
                case 1:
                case 2:
                case 3:
                    $jsonStructure = ['ode_id' => '', 'ode_filename' => '', 'ode_file' => '', 'ode_uri' => '', 'ode_user' => '', 'jwt_token' => ''];

                    return $jsonStructure;
                default:
                    return false;
            }
        }
    }

    /**
     * Get platform selected on settings.
     */
    public static function setPlatform()
    {
        return Settings::PLATFORMS[Settings::PLATFORM_INTEGRATION];
    }
}
