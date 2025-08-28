<?php

namespace App\Tests\Controller;

use App\Controller\net\exelearning\Controller\ErrorController;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\ErrorHandler\Exception\FlattenException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Log\DebugLoggerInterface;

class ErrorControllerTest extends KernelTestCase
{
    private $controller;
    private $twig;

    protected function setUp(): void
    {
        self::bootKernel();
        
        // Get the service container
        $container = static::getContainer();
        
        // Get the Twig service
        $this->twig = $container->get('twig');
        
        // Create an instance of the controller
        $this->controller = new ErrorController();
        // Set the container on the controller
        $controllerReflection = new \ReflectionClass($this->controller);
        $containerProperty = $controllerReflection->getProperty('container');
        $containerProperty->setAccessible(true);
        $containerProperty->setValue($this->controller, $container);
    }

    public function testShowRendersErrorTemplate()
    {
        // Create a mock for FlattenException
        $exception = $this->createMock(FlattenException::class);
        $exception->method('getStatusCode')->willReturn(500);
        $exception->method('getMessage')->willReturn('Test error message');

        // Create a Request
        $request = new Request();

        // Capture the rendering
        $response = $this->controller->show($request, $exception);

        // Assert that the response is an instance of Response
        $this->assertInstanceOf(Response::class, $response);
        
        // Assert that the status code is correct
        $this->assertEquals(500, $response->getStatusCode());
        
        // Assert that the content is not empty
        $this->assertNotEmpty($response->getContent());
    }

    public function testShowHandlesDifferentErrorCodes()
    {
        $errorCodes = [400, 403, 404, 500];
        
        foreach ($errorCodes as $code) {
            // Create a mock for FlattenException with different codes
            $exception = $this->createMock(FlattenException::class);
            $exception->method('getStatusCode')->willReturn($code);
            $exception->method('getMessage')->willReturn("Error $code message");

            // Create a Request
            $request = new Request();

            // Get the response
            $response = $this->controller->show($request, $exception);

            // Assert that the status code is correct
            $this->assertEquals($code, $response->getStatusCode(), "'The status code should be $code");
        }
    }

    public function testErrorTemplateReceivesCorrectParameters()
    {
        // Create a mock for the Twig environment
        $twigEnvironment = $this->createMock(\Twig\Environment::class);
        
        // Replace the Twig service in the controller
        $controllerReflection = new \ReflectionClass($this->controller);
        $twigProperty = $controllerReflection->getProperty('twig');
        $twigProperty->setAccessible(true);
        $twigProperty->setValue($this->controller, $twigEnvironment);
        
        // Set expectations for the render call
        $twigEnvironment->expects($this->once())
            ->method('render')
            ->with(
                $this->equalTo('security/error.html.twig'),
                $this->callback(function ($parameters) {
                    // Assert that the expected parameters are present
                    return isset($parameters['status_code']) &&
                           isset($parameters['status_text']) &&
                           isset($parameters['error']) &&
                           $parameters['status_code'] === 404 &&
                           $parameters['error'] === 'Page not found';
                })
            )
            ->willReturn('rendered template');
        
        // Create a mock for FlattenException
        $exception = $this->createMock(FlattenException::class);
        $exception->method('getStatusCode')->willReturn(404);
        $exception->method('getMessage')->willReturn('Page not found');

        // Create a Request
        $request = new Request();

        // Execute the show method
        $this->controller->show($request, $exception);
    }
    
    public function testErrorTemplateHandlesEmptyErrorMessage()
    {
        // Create a mock for FlattenException with an empty message
        $exception = $this->createMock(FlattenException::class);
        $exception->method('getStatusCode')->willReturn(500);
        $exception->method('getMessage')->willReturn('');

        // Create a Request
        $request = new Request();

        // Get te response
        $response = $this->controller->show($request, $exception);

        // Assert that it still returns a valid response
        $this->assertInstanceOf(Response::class, $response);
        $this->assertEquals(500, $response->getStatusCode());
    }
}