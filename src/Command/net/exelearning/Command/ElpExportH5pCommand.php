<?php

namespace App\Command\net\exelearning\Command;

use App\Constants;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(
    name: 'elp:export-h5p',
    description: 'Export ELP to H5P format',
)]
class ElpExportH5pCommand extends ElpExportCommand
{
    protected string $defaultFormat = Constants::EXPORT_TYPE_H5P;
}
