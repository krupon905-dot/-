// Google Apps Script for Lesson Plan Submission System
// SHEET_ID: 1RLJy7jjOeqxqJk2F8-9B4Enom6jCd96sheCG5CcymDU
// FOLDER_ID: 1xWwnH34MpmCy26X0ui_pFq95IzhCEYVX

const SHEET_ID = '1RLJy7jjOeqxqJk2F8-9B4Enom6jCd96sheCG5CcymDU';
const FOLDER_ID = '1xWwnH34MpmCy26X0ui_pFq95IzhCEYVX';
const SHEET_NAME = 'sheet1';

function doPost(e) {
  let p;
  try {
    if (e.postData && e.postData.contents) {
      p = JSON.parse(e.postData.contents);
    } else {
      p = e.parameter;
    }
  } catch (err) {
    p = e.parameter;
  }
  
  const action = p.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  try {
    if (action === 'submit') {
      const fileUrl = p.fileUrl;
      
      const rowData = [
        Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss"), // A: Timestamp
        p.userName,       // B: Name
        p.department,    // C: Dept
        p.level,         // D: Level
        p.subjectId,     // E: Subject Code (รหัสวิชา)
        p.subjectName,   // F: Subject Name (ชื่อวิชา)
        fileUrl,         // G: File URL
        p.year,          // H: Year
        p.semester,      // I: Semester
        'pending',       // J: Status
        '',              // K: Checker Name
        '',              // L: Checker Position
        '',              // M: Approver Name
        '',              // N: Approver Position
        '',              // O: Check Date
        '',              // P: Approve Date
        Utilities.getUuid() // Q: ID
      ];
      
      sheet.appendRow(rowData);
      return response({ status: 'success', message: 'ส่งข้อมูลเรียบร้อยแล้ว' });
    }
    
    if (action === 'check') {
      updateRow(sheet, p.id, {
        status: 'checked',
        checkerName: p.checkerName,
        checkerPosition: p.checkerPosition,
        checkDate: Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm")
      });
      return response({ status: 'success' });
    }
    
    if (action === 'approve') {
      updateRow(sheet, p.id, {
        status: 'approved',
        approverName: p.approverName,
        approverPosition: p.approverPosition,
        approveDate: Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm")
      });
      return response({ status: 'success' });
    }
    
    if (action === 'edit') {
      updateRow(sheet, p.id, { subjectId: p.subjectId, subjectName: p.subjectName });
      return response({ status: 'success' });
    }
    
    if (action === 'delete') {
      const data = sheet.getDataRange().getValues();
      const idCol = 16; 
      for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === p.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return response({ status: 'success' });
    }
    
  } catch (err) {
    return response({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getData') {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      results.push({
        timestamp: row[0],
        userName: row[1],
        department: row[2],
        level: row[3],
        subjectId: row[4],
        subjectName: row[5],
        fileUrl: row[6],
        year: row[7],
        semester: row[8],
        status: row[9],
        checkerName: row[10],
        checkerPosition: row[11],
        approverName: row[12],
        approverPosition: row[13],
        checkDate: row[14],
        approveDate: row[15],
        id: row[16]
      });
    }
    return response(results);
  }
}

function updateRow(sheet, id, updates) {
  const data = sheet.getDataRange().getValues();
  const idCol = 16; 
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      const rowNum = i + 1;
      if (updates.status) sheet.getRange(rowNum, 10).setValue(updates.status);
      if (updates.checkerName) sheet.getRange(rowNum, 11).setValue(updates.checkerName);
      if (updates.checkerPosition) sheet.getRange(rowNum, 12).setValue(updates.checkerPosition);
      if (updates.approverName) sheet.getRange(rowNum, 13).setValue(updates.approverName);
      if (updates.approverPosition) sheet.getRange(rowNum, 14).setValue(updates.approverPosition);
      if (updates.checkDate) sheet.getRange(rowNum, 15).setValue(updates.checkDate);
      if (updates.approveDate) sheet.getRange(rowNum, 16).setValue(updates.approveDate);
      if (updates.subjectId) sheet.getRange(rowNum, 5).setValue(updates.subjectId);
      if (updates.subjectName) sheet.getRange(rowNum, 6).setValue(updates.subjectName);
      break;
    }
  }
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
