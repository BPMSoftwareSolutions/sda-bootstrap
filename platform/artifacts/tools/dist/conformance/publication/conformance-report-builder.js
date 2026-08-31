export class ConformanceReportBuilder {
    build(result) { const lines = []; for (const admission of result.admissions) {
        lines.push(`SCENARIO KERNEL — ${admission.language.toUpperCase()}`, `ADMISSION: ${admission.admissionDisposition}`);
        for (const obligation of admission.obligations)
            lines.push(`  ${obligation.label.padEnd(28)}${obligation.disposition}`);
        lines.push(`  Implementation Origin       ${admission.implementationOrigin.origin}`, "");
    } if (result.crossLanguage)
        lines.push("CROSS-LANGUAGE KERNEL CONFORMANCE", `Behavioral equivalence: ${result.crossLanguage.equivalentCount} / ${result.crossLanguage.totalFixtures}`); return `${lines.join("\n")}\n`; }
}
