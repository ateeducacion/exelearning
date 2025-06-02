<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlFillIdevice.
 */
class OdeOldXmlFillIdevice
{
    public const JSON_QUESTIONS = [
        'activityType' => 'fill',
        'baseText' => '',
        'capitalization' => '',
        'strict' => '',
    ];

    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'eXeFormInstructions' => '',
        'questionsData' => ['{{addQuestions}}'],
        'formPreview' => '',
        'dropdownPassRate' => '50',
        'checkAddBtnAnswers' => true,
        'userTranslations' => [
            'langTrueFalseHelp' => 'Select whether the statement is true or false',
            'langDropdownHelp' => 'Choose the correct answer among the options proposed',
            'langSingleSelectionHelp' => 'Multiple choice with only one correct answer',
            'langMultipleSelectionHelp' => 'Multiple choice with multiple corrects answers',
            'langFillHelp' => 'Fill in the blanks with the appropriate word',
        ],
    ];

    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    public static function oldElpFillIdeviceStructure($odeSessionId, $odePageId, $fillNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($fillNodes as $fillNode) {
            $fillNode->registerXPathNamespace('f', $xpathNamespace);
            $nodeIdevices = $fillNode->xpath("f:dictionary/f:instance[@class='exe.engine.field.ClozeField']");
            $instructionsIdevice = $fillNode->xpath("f:dictionary/f:string[@value='instructionsForLearners']/following-sibling::f:instance[1]")[0];

            // Get blockName
            $blockNameNode = $fillNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            $instructionsIdevice->registerXPathNamespace('f', $xpathNamespace);
            $instructionsIdeviceContent = $instructionsIdevice->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
            following-sibling::f:unicode[@content='true']");
            foreach ($nodeIdevices as $nodeIdevice) {
                // IDEVICE TEXT CONTENT
                if ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY}->{self::OLD_ODE_XML_UNICODE}) {
                    $subOdePagStructureSync = new OdePagStructureSync();
                    $odeBlockId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $odeBlockId;

                    // OdePagStructureSync fields
                    $subOdePagStructureSync->setOdeSessionId($odeSessionId);
                    $subOdePagStructureSync->setOdePageId($odePageId);
                    $subOdePagStructureSync->setOdeBlockId($odeBlockId);
                    // $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});

                    // $odeBlockTitle = $oldXmlListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}["value"][0];
                    $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

                    $orderPage = (string) $nodeIdevice['reference'];
                    $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($orderPage));

                    // Get pagStructureSync properties
                    $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();
                    // foreach($oldXmlListInstDict->{self::OLD_ODE_XML_UNICODE} as $oldXmlListInstDictUnicode){
                    //     // array_push($odeResponse, $oldXmlListInstDictUnicode);
                    //     if($oldXmlListInstDictUnicode["value"]) {
                    //         $odePagStructureSync->setBlockName($oldXmlListInstDictUnicode["value"]);
                    //     }

                    // }

                    $odeComponentsSync = new OdeComponentsSync();
                    $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $odeIdeviceId;
                    $odeComponentsMapping[] = $odeIdeviceId;

                    // OdeComponentsSync fields
                    $odeComponentsSync->setOdeSessionId($odeSessionId);
                    $odeComponentsSync->setOdePageId($odePageId);
                    $odeComponentsSync->setOdeBlockId($odeBlockId);
                    $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);

                    // $odeComponentsSync->setJsonProperties($odeComponentsSyncJsonProperties);

                    $odeComponentsSync->setOdeComponentsSyncOrder(intval(1));
                    // Set type
                    $odeComponentsSync->setOdeIdeviceTypeName('form');

                    foreach ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY} as $oldXmlListDictListInstDictListInstDict) {
                        $oldXmlListDictListInstDictListInstDict->registerXPathNamespace('f', $xpathNamespace);
                        $checkCaps = $oldXmlListDictListInstDictListInstDict->xpath("f:string[@value='checkCaps']/
                        following-sibling::f:bool[1]/@value");
                        $strictText = $oldXmlListDictListInstDictListInstDict->xpath("f:string[@value='strictMarking']/
                        following-sibling::f:bool[1]/@value");
                        $baseTextHtmlContent = $oldXmlListDictListInstDictListInstDict->xpath("f:string[@value='_encodedContent']/
                        following-sibling::f:unicode[1]");

                        $sessionPath = null;

                        if (!empty($odeSessionId)) {
                            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                        }

                        // Common replaces for all OdeComponents
                        $commonReplaces = [
                            'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                        ];

                        if (isset($baseTextHtmlContent)) {
                            if (isset($commonReplaces)) {
                                $odeComponentsSyncHtmlView = self::applyReplaces($commonReplaces, (string) $baseTextHtmlContent[0]['value']);
                            } else {
                                $odeComponentsSyncHtmlView = (string) $baseTextHtmlContent[0]['value'];
                            }

                            // $htmlReplace = ["{{changeContent}}" => $odeComponentsSyncHtmlView];
                            // $fillFormPreview = self::applyHtmlChange($htmlReplace, $fillFormPreview);

                            $prologue = '<?xml encoding="UTF-8">';
                            $html = $prologue.$odeComponentsSyncHtmlView;
                            $doc = new \DOMDocument();
                            @$doc->loadHTML($html);
                            $xpath = new \DOMXPath($doc);
                            $src = $xpath->evaluate('//img/@src', $doc); // "/images/image.jpg"
                            foreach ($src as $srcValue) {
                                $srcString = (string) $srcValue->value;
                                array_push($result['srcRoutes'], $srcString);
                            }

                            // Change "0/1" to "false/true"
                            $booleanChanges =
                                [
                                    '0' => 'false',
                                    '1' => 'true',
                                ];
                            $checkCaps = self::applyReplaces($booleanChanges, $checkCaps[0]);
                            $strictText = self::applyReplaces($booleanChanges, $strictText[0]);

                            $jsonQuestions = self::JSON_QUESTIONS;
                            $jsonQuestions['baseText'] = $odeComponentsSyncHtmlView;
                            $jsonQuestions['capitalization'] = (string) $checkCaps;
                            $jsonQuestions['strict'] = (string) $strictText;

                            $jsonQuestions = json_encode($jsonQuestions);

                            // $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                            $jsonProperties = self::JSON_PROPERTIES;
                            $jsonProperties['ideviceId'] = $odeIdeviceId;
                            $jsonProperties['eXeFormInstructions'] = (string) $instructionsIdeviceContent[0]['value'];

                            $jsonProperties = json_encode($jsonProperties);

                            $changesJson = ['"{{addQuestions}}"' => $jsonQuestions];
                            $jsonProperties = self::applyHtmlChange($changesJson, $jsonProperties);

                            // Create jsonProperties for idevice
                            $odeComponentsSync->setJsonProperties($jsonProperties);

                            // OdeComponentsSync property fields
                            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                            // $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[1]["value"];
                            $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                        }
                    }
                }
                array_push($result['odeComponentsSync'], $subOdePagStructureSync);
            }
        }

        return $result;
    }

    /**
     * Applies the replaces passed as param.
     *
     * @param array  $replaces
     * @param string $text
     */
    private static function applyReplaces($replaces, $text)
    {
        $result = $text;

        foreach ($replaces as $search => $replace) {
            $result = str_replace($search, $replace, $result);
        }

        return $result;
    }

    /**
     * Applies the replaces passed as param.
     *
     * @param array  $replaces
     * @param string $text
     */
    private static function applyHtmlChange($replaces, $text)
    {
        $result = $text;

        foreach ($replaces as $search => $replace) {
            $result = str_replace($search, $replace, $result);
        }

        return $result;
    }
}
