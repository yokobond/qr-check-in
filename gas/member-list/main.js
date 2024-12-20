const activeSpreadSheet = SpreadsheetApp.getActiveSpreadsheet();

/**
 * Respond to GET requests to the published web app
 * - 'find' action: return member data
 * @param {GoogleAppsScript.Events.DoGet} e event parameter
 * @returns {GoogleAppsScript.Content.TextOutput} output
 */
function doGet(e) {
    const reqParam = e.parameter;//パラメーターを取得
    switch (reqParam.action) {//actionパラメーターの内容によって処理を分岐
        case "find": // return member data
            {
                const memberId = reqParam.id;
                const data = getMemberData(memberId);
                return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
            }
            break;
        default:
            {
                const result = 'did nothing';
                return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
            }
            break;
    }
}

/**
 * Test doGet
 */
function doGetTest() {
    //eの作成
    var e = {};
    e.parameter = {
        action: 'find',
        id: '0d6v',
    };
    //呼び出す。
    doGet(e);
}

/**
 * column list
 * @type {Array<string>} column list
 */
const columnList = ['email', 'name', 'school', 'detail', 'card printed', 'card type', 'card URL', 'ID', 'register date', 'update date', '3D printer Sermoon V1', 'UV printer birdland', 'laser cutter Helix', 'photo printer', 'A1 printer', 'milling MonoFab', 'sewing Vivace', 'soldering'];

const emailColumn = columnList.indexOf('email') + 1;
const nameColumn = columnList.indexOf('name') + 1;
const cardTypeColumn = columnList.indexOf('card type') + 1;
const cardURLColumn = columnList.indexOf('card URL') + 1;
const idColumn = columnList.indexOf('ID') + 1;
const registerDateColumn = columnList.indexOf('register date') + 1;

/**
 * Get member data by ID
 * @param {string} memberId member ID
 * @returns {?Array} member data or null if not found
 */
function getMemberData(memberId) {
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const data = dataSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (data[i][idColumn - 1] == memberId) {
            return data[i];
        }
    }
    return null;
}

/**
 * Get member data by email
 * @param {string} email email
 * @returns {?Array} member data or null if not found
 */
function getMemberDataByEmail(email) {
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const data = dataSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (data[i][emailColumn - 1] == email) {
            return data[i];
        }
    }
    return null;
}

/**
 * Test getMemberData
 */
function testGetMemeberData() {
    console.log(getMemberData('0d6v'));
}

/**
 * Handle open event
 * - Add menu for membership
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu('Membership');
    menu.addItem('Create Cards', 'createCards');
    menu.addToUi();
}

/**
 * Fill template slide page with data
 * @param {GoogleAppsScript.Slides.Slide} slide slide
 * @param {string} id member ID
 * @param {string} qrURL QR code URL
 * @param {string} name member name
 * @returns {void}
 */
function fillSlide(slide, id, qrURL, name) {
    slide.getPageElements().forEach(elm => {
        // Logger.log(elm.getPageElementType());
        // Logger.log(elm.getTitle());
        if (elm.getTitle() === 'QR') {
            if (elm.getPageElementType() === SlidesApp.PageElementType.IMAGE) {
                elm.asImage().replace(qrURL);
            }
            if (elm.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
                elm.asShape().replaceWithImage(qrURL);
            }
        }
        if (elm.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
            elm.asShape().getText().replaceAllText('{{id}}', id);
            elm.asShape().getText().replaceAllText('{{name}}', name);
        }
    })
}

/**
 * Fill card data
 * @param {GoogleAppsScript.Slides.Presentation} card card
 * @param {string} id member ID
 * @param {string} qrURL QR code URL
 * @param {string} name member name
 * @returns {void}
 */
function fillCardData(card, id, qrURL, name) {
    const slides = card.getSlides();
    slides.forEach(sld => {
        fillSlide(sld, id, qrURL, name);
    });
}

/**
 * Update cards by range
 * @param {GoogleAppsScript.Spreadsheet.Range} range range
 * @returns {void}
 */
function updateCardsByRange(range) {
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const startRow = range.getRow();
    const startColumn = 1;
    const numRows = range.getNumRows();
    const cardDataRows = dataSheet.getRange(startRow, startColumn, numRows, dataSheet.getLastColumn()).getValues();

    const workFolder = DriveApp.getFileById(activeSpreadSheet.getId()).getParents().next();
    const cardFolder = workFolder.getFoldersByName('member-cards').next();

    for (var i = 0; i < cardDataRows.length; i++) {
        var row = cardDataRows[i];
        if (row[cardURLColumn - 1] != '') {
            console.log(`Skip for non empty card URL on row: ${startRow + i}`);
            continue;
        }
        let id = row[idColumn - 1];
        const name = row[nameColumn - 1];
        if (name == '') {
            console.log(`Skip for no name on row: ${startRow + i}`);
            continue;
        }
        if (id == '') {
            const newId = generateMemberId();
            dataSheet.getRange(startRow + i, idColumn).setValue(newId);
            dataSheet.getRange(startRow + i, registerDateColumn).setValue(Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd'));
            id = newId;
            console.log(`Generate ID "${newId}" on row: ${startRow + i}`);
        }
        const qrURL = 'https://quickchart.io/qr?size=200x200&text=' + id;
        const cardName = `${id}`;
        // clean up the previous cards
        const oldCards = DriveApp.getFilesByName(cardName);
        while (oldCards.hasNext()) {
            oldCards.next().setTrashed(true);
        }
        // create the new card
        let cardType = row[cardTypeColumn - 1];
        if (cardType === '') cardType = 'default';
        const cardTemplate = workFolder.getFilesByName(`card-template-${cardType}`).next();
        const cardFile = cardTemplate.makeCopy(cardName, cardFolder);
        const card = SlidesApp.openById(cardFile.getId());
        fillCardData(card, id, qrURL, name);
        const cardURL = cardFile.getUrl();
        dataSheet.getRange(startRow + i, cardURLColumn).setValue(cardURL);
        Logger.log(`update card: ${id} for ${name}`);
    }
}

/**
 * Update cards by selection
 * @returns {void}
 */
function updateCardsBySelection() {
    const dataSheet = activeSpreadSheet.getActiveSheet();
    const ranges = dataSheet.getSelection().getActiveRangeList().getRanges();
    ranges.forEach(range => {
        updateCardsByRange(range);
    });
}

/**
 * Test updateCardsBySelection
 */
function testSelection() {
    var activeSheet = SpreadsheetApp.getActiveSheet();
    var rangeList = activeSheet.getRangeList(['A1:B4', 'D1:E4']);
    rangeList.activate();

    var selection = activeSheet.getSelection();
    // Current Cell: D1
    console.log('Current Cell: ' + selection.getCurrentCell().getA1Notation());
    // Active Range: D1:E4
    console.log('Active Range: ' + selection.getActiveRange().getA1Notation());
    // Active Ranges: A1:B4, D1:E4
    var ranges = selection.getActiveRangeList().getRanges();
    for (var i = 0; i < ranges.length; i++) {
        console.log('Active Ranges: ' + ranges[i].getA1Notation());
    }
    console.log('Active Sheet: ' + selection.getActiveSheet().getName());
}

/**
 * Fill all empty card URL of the data sheet
 */
function fillEmptyCardUrl() {
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const dataRange = dataSheet.getDataRange();
    updateCardsByRange(dataRange);
}

/**
 * Generate new unique ID
 */
function generateMemberId() {
    const characters = "abcdefghijklmnopqrstuvwxyz";
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const data = dataSheet.getDataRange().getValues();
    const idHeader = `${(new Date()).getFullYear() - 2023}`;
    let memberId;
    while (true) {
        memberId = idHeader;
        memberId += characters.charAt(Math.floor(Math.random() * characters.length));
        memberId += Math.floor(Math.random() * 10);
        memberId += characters.charAt(Math.floor(Math.random() * characters.length));
        let exist = false;
        for (let i = 0; i < data.length; i++) {
            if (data[i][idColumn - 1] == memberId) {
                Logger.log(`ID ${memberId} already exists`);
                exist = true;
                break;
            }
        }
        if (!exist) {
            break;
        }
    }
    return memberId;
}

/**
 * Test generateMemberId
 */
function testGenerateMemberId() {
  const ids = [];
  let count = 0;
  while(count < 10) {
    ids.push(generateMemberId());
  }
  Logger.log(ids);
}

/**
 * Fill all empty member ID of the data sheet
 */
function fillEmptyMemberId() {
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const firstRow = 2;
    const lastRow = dataSheet.getLastRow();
    for (let i = firstRow; i <= lastRow; i++) {
        let cell = dataSheet.getRange(i, idColumn);
        if (cell.isBlank()) {
            const newId = generateMemberId();
            cell.setValue(newId);
            console.log(newId);
        }
    }
}

/**
 * Copy registered data to data sheet when the email is not found
 */
function copyRegisterToData() {
    const registerSheet = activeSpreadSheet.getSheetByName('Register');
    const dataSheet = activeSpreadSheet.getSheetByName('Data');
    const registerFirstRow = 2;
    const registerLastRow = registerSheet.getLastRow();
    const registerEmailColumn = 2;
    for (let i = registerFirstRow; i <= registerLastRow; i++) {
        let email = registerSheet.getRange(i, registerEmailColumn);
        if (!email.isBlank()) {
            let memberData = getMemberDataByEmail(email.getValue());
            if (memberData) {
                continue;
            }
        }
        const data = registerSheet.getRange(i, 2, 1, registerSheet.getLastColumn() - 1).getValues();
        dataSheet.getRange(dataSheet.getLastRow() + 1, 1, 1, data[0].length).setValues(data);
    }
}

/**
 * Create cards
 */
function createCards() {
    copyRegisterToData();
    fillEmptyCardUrl();
}