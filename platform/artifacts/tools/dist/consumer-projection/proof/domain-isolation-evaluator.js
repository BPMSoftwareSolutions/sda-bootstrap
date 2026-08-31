export const BANNED_DOMAIN_TERMS = Object.freeze([
    "resume", "resumé", "applicant", "job", "hiring", "recruiter", "interview",
    "medical", "diagnosis", "patient", "invoice", "banking", "loan", "mortgage"
]);
export const BANNED_DOMAIN_ALGORITHM_MARKERS = Object.freeze([
    "extract-evidence-document",
    "extract-requirement-source",
    "project-evidence-document",
    "experienceSectionHeadings",
    "requirementSectionHeadings",
    "skillVocabulary"
]);
export class DomainIsolationEvaluator {
    evaluate(files) {
        const violations = [];
        for (const file of files) {
            for (const term of BANNED_DOMAIN_TERMS) {
                if (new RegExp(`\\b${term}\\b`, "i").test(file.content))
                    violations.push({ file: file.path, term });
            }
            for (const marker of BANNED_DOMAIN_ALGORITHM_MARKERS) {
                if (file.content.includes(marker))
                    violations.push({ file: file.path, term: marker });
            }
        }
        return Object.freeze({
            evidenceType: "consumer-domain-isolation-evidence.v1",
            scannedFiles: files.length,
            violations: Object.freeze(violations),
            valid: violations.length === 0,
            disposition: violations.length === 0 ? "DOMAIN_ISOLATED" : "DOMAIN_LEAKAGE_DETECTED"
        });
    }
}
