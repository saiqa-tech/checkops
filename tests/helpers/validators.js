/**
 * Test Helper - ID Validators
 * 
 * Validators for v4.0.0 dual-ID system
 */

/**
 * Check if string is a valid UUID
 * @param {string} str - String to validate
 * @returns {boolean}
 */
export function isUUID(str) {
    if (typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Check if string is a valid SID with given prefix
 * @param {string} str - String to validate
 * @param {string} prefix - Expected prefix (e.g., 'FORM', 'Q', 'SUB')
 * @returns {boolean}
 */
export function isSID(str, prefix) {
    if (typeof str !== 'string') return false;
    const sidRegex = new RegExp(`^${prefix}-\\d+$`);
    return sidRegex.test(str);
}

/**
 * Validate form object has both UUID and SID
 * @param {object} form - Form object to validate
 * @throws {Error} if validation fails
 */
export function validateFormIds(form) {
    if (!form) throw new Error('Form is null or undefined');
    if (!isUUID(form.id)) throw new Error(`Invalid form UUID: ${form.id}`);
    if (!isSID(form.sid, 'FORM')) throw new Error(`Invalid form SID: ${form.sid}`);
}

/**
 * Validate question object has both UUID and SID
 * @param {object} question - Question object to validate
 * @throws {Error} if validation fails
 */
export function validateQuestionIds(question) {
    if (!question) throw new Error('Question is null or undefined');
    if (!isUUID(question.id)) throw new Error(`Invalid question UUID: ${question.id}`);
    if (!isSID(question.sid, 'Q')) throw new Error(`Invalid question SID: ${question.sid}`);
}

/**
 * Validate submission object has both UUID and SID
 * @param {object} submission - Submission object to validate
 * @throws {Error} if validation fails
 */
export function validateSubmissionIds(submission) {
    if (!submission) throw new Error('Submission is null or undefined');
    if (!isUUID(submission.id)) throw new Error(`Invalid submission UUID: ${submission.id}`);
    if (!isSID(submission.sid, 'SUB')) throw new Error(`Invalid submission SID: ${submission.sid}`);
    if (!isUUID(submission.formId)) throw new Error(`Invalid formId UUID: ${submission.formId}`);
    if (!isSID(submission.formSid, 'FORM')) throw new Error(`Invalid formSid: ${submission.formSid}`);
}
