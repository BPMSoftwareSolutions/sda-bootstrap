import ts from "typescript";
function location(sourceFile, node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return `${sourceFile.fileName}:${start.line + 1}:${start.character + 1}`;
}
function finding(code, path, message) {
    return { code, path, message };
}
function propertyName(sourceFile, name) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
    }
    return null;
}
function containsExecutableMeaning(node) {
    let found = false;
    const visit = (candidate) => {
        if (ts.isFunctionLike(candidate) ||
            ts.isClassLike(candidate) ||
            ts.isIfStatement(candidate) ||
            ts.isSwitchStatement(candidate) ||
            ts.isForStatement(candidate) ||
            ts.isForInStatement(candidate) ||
            ts.isForOfStatement(candidate) ||
            ts.isWhileStatement(candidate) ||
            ts.isDoStatement(candidate) ||
            ts.isConditionalExpression(candidate) ||
            ts.isCallExpression(candidate) ||
            ts.isNewExpression(candidate)) {
            found = true;
            return;
        }
        ts.forEachChild(candidate, visit);
    };
    visit(node);
    return found;
}
function literalValue(sourceFile, node, semanticPath, findings) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }
    if (ts.isNumericLiteral(node)) {
        return Number(node.text);
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword)
        return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword)
        return false;
    if (node.kind === ts.SyntaxKind.NullKeyword)
        return null;
    if (ts.isPrefixUnaryExpression(node) &&
        node.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(node.operand)) {
        return -Number(node.operand.text);
    }
    if (ts.isArrayLiteralExpression(node)) {
        const result = [];
        node.elements.forEach((element, index) => {
            if (ts.isSpreadElement(element)) {
                findings.push(finding("DYNAMIC_CARRIER_SYNTAX", `${semanticPath}/${index}`, `Spread syntax is not admitted (${location(sourceFile, element)}).`));
                return;
            }
            const value = literalValue(sourceFile, element, `${semanticPath}/${index}`, findings);
            if (value !== undefined)
                result.push(value);
        });
        return result;
    }
    if (ts.isObjectLiteralExpression(node)) {
        const result = {};
        const seen = new Set();
        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) {
                const code = containsExecutableMeaning(property)
                    ? "HIDDEN_EXECUTABLE_MEANING"
                    : "DYNAMIC_CARRIER_SYNTAX";
                findings.push(finding(code, semanticPath, `Only literal property assignments are admitted (${location(sourceFile, property)}).`));
                continue;
            }
            const key = propertyName(sourceFile, property.name);
            if (key === null) {
                findings.push(finding("DYNAMIC_CARRIER_SYNTAX", semanticPath, `Computed property names are not admitted (${location(sourceFile, property.name)}).`));
                continue;
            }
            const childPath = `${semanticPath}/${key}`;
            if (seen.has(key)) {
                findings.push(finding("DUPLICATE_CARRIER_PROPERTY", childPath, `A carrier property may be declared only once (${location(sourceFile, property.name)}).`));
                continue;
            }
            seen.add(key);
            if (containsExecutableMeaning(property.initializer)) {
                findings.push(finding("HIDDEN_EXECUTABLE_MEANING", childPath, `Executable syntax cannot carry semantic meaning (${location(sourceFile, property.initializer)}).`));
                continue;
            }
            const value = literalValue(sourceFile, property.initializer, childPath, findings);
            if (value !== undefined)
                result[key] = value;
        }
        return result;
    }
    findings.push(finding(containsExecutableMeaning(node) ? "HIDDEN_EXECUTABLE_MEANING" : "DYNAMIC_CARRIER_SYNTAX", semanticPath, `Only JSON-literal carrier values are admitted (${location(sourceFile, node)}).`));
    return undefined;
}
function isAdmittedImport(statement) {
    if (!ts.isStringLiteral(statement.moduleSpecifier))
        return false;
    if (!/^(?:\.\.\/)+src\/index\.js$/.test(statement.moduleSpecifier.text))
        return false;
    const bindings = statement.importClause?.namedBindings;
    return (statement.importClause?.isTypeOnly === false &&
        statement.importClause.name === undefined &&
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length === 1 &&
        bindings.elements[0]?.name.text === "defineCapability" &&
        bindings.elements[0].propertyName === undefined);
}
export function parseCarrierSource(source, sourceId) {
    const sourceFile = ts.createSourceFile(sourceId, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const findings = [];
    const diagnostics = sourceFile.parseDiagnostics ?? [];
    for (const diagnostic of diagnostics) {
        const start = diagnostic.start ?? 0;
        const position = sourceFile.getLineAndCharacterOfPosition(start);
        findings.push(finding("TYPESCRIPT_PARSE_ERROR", `${sourceId}:${position.line + 1}:${position.character + 1}`, ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")));
    }
    const imports = sourceFile.statements.filter(ts.isImportDeclaration);
    if (imports.length !== 1 || !isAdmittedImport(imports[0])) {
        findings.push(finding("CARRIER_IMPORT_NOT_ADMITTED", "/", "The carrier must import only defineCapability from the local src/index.js module."));
    }
    const exportAssignments = sourceFile.statements.filter(ts.isExportAssignment);
    const unexpected = sourceFile.statements.filter((statement) => !ts.isImportDeclaration(statement) && !ts.isExportAssignment(statement));
    for (const statement of unexpected) {
        findings.push(finding(containsExecutableMeaning(statement)
            ? "HIDDEN_EXECUTABLE_MEANING"
            : "CARRIER_TOP_LEVEL_NOT_ADMITTED", "/", `Only the admitted import and one default export are allowed (${location(sourceFile, statement)}).`));
    }
    if (exportAssignments.length !== 1 || exportAssignments[0]?.isExportEquals === true) {
        findings.push(finding("CARRIER_ROOT_MISSING", "/", "Exactly one default carrier export is required."));
        return { value: null, findings };
    }
    const root = exportAssignments[0].expression;
    if (!ts.isCallExpression(root) ||
        !ts.isIdentifier(root.expression) ||
        root.expression.text !== "defineCapability" ||
        root.arguments.length !== 1 ||
        !ts.isObjectLiteralExpression(root.arguments[0])) {
        findings.push(finding("CARRIER_ROOT_NOT_ADMITTED", "/", "The default export must be defineCapability({...}) with one literal object argument."));
        return { value: null, findings };
    }
    const value = literalValue(sourceFile, root.arguments[0], "", findings);
    return { value: value ?? null, findings };
}
