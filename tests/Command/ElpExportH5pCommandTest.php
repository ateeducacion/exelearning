<?php
namespace App\Tests\Command;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportH5pCommand;
use App\Entity\net\exelearning\Entity\User;
use App\Repository\net\exelearning\Repository\UserRepository;
use App\Tests\Utils\H5PFrameworkStub;
use H5PCore;
use H5PValidator;

class ElpExportH5pCommandTest extends KernelTestCase
{
    private CommandTester $commandTester;
    private Filesystem $filesystem;
    private array $tempPaths = [];

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();
        $this->filesystem = new Filesystem();

        // Ensure test user exists
        $repo = $container->get(UserRepository::class);
        $em = $container->get('doctrine.orm.entity_manager');
        if (!$repo->find(1)) {
            $u = new User();
            $u->setUserId(1);
            $u->setEmail('tests@example.com');
            $u->setPassword('pass');
            $u->setIsLopdAccepted(true);
            $meta = $em->getClassMetadata(User::class);
            $meta->setIdGeneratorType(\Doctrine\ORM\Mapping\ClassMetadata::GENERATOR_TYPE_NONE);
            $em->persist($u);
            $em->flush();
        }

        $application = new Application();
        $command = $container->get(ElpExportH5pCommand::class);
        $application->add($command);
        $this->commandTester = new CommandTester($command);
    }

    /**
     * @dataProvider elpFileProvider
     */
    public function testExportElpToH5p(string $fixture): void
    {
        $inputFile = realpath(__DIR__.'/../Fixtures/'.$fixture);
        $outputDir = sys_get_temp_dir().'/elp_export_h5p_'.uniqid();
        mkdir($outputDir, 0755, true);
        $this->tempPaths[] = $outputDir;
        $this->assertFileExists($inputFile);

        $this->commandTester->execute([
            'command' => 'elp:export-h5p',
            'input' => $inputFile,
            'output' => $outputDir,
            '--debug' => true,
        ]);

        $this->assertSame(0, $this->commandTester->getStatusCode());
        $files = glob($outputDir.'/*.h5p');
        $this->assertNotEmpty($files, 'No h5p file generated');
        $h5p = $files[0];

        $framework = new H5PFrameworkStub($h5p);
        $core = new H5PCore($framework, sys_get_temp_dir().'/h5p_core_'.uniqid(), '/');
        $validator = new H5PValidator($framework, $core);
        $this->assertTrue($validator->isValidPackage(), 'Generated H5P failed validation');
    }

    public static function elpFileProvider(): array
    {
        return [
            ['basic-example.elp'],
        ];
    }

    protected function tearDown(): void
    {
        foreach ($this->tempPaths as $path) {
            if ($this->filesystem->exists($path)) {
                $this->filesystem->remove($path);
            }
        }
    }
}
