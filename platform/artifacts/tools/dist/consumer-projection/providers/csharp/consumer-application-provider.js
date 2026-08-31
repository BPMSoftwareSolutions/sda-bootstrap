import path from "node:path";
import { sha256 } from "../../../primitives/sha256.js";
function entry(relativePath, content, sourcePointers = ["languages/csharp/src/ScenarioKernel.Platform"]) {
    return Object.freeze({ relativePath, content, digest: sha256(content), sourcePointers, target: "csharp" });
}
export function resolveAdapterProjectRef(repositoryRoot, projectedCsharpDir) {
    const adapter = path.resolve(repositoryRoot, "languages", "csharp", "src", "ScenarioKernel.Platform", "ScenarioKernel.Platform.csproj");
    return path.relative(projectedCsharpDir, adapter).replaceAll("/", "\\");
}
export function resolveWpfProjectRef(repositoryRoot, projectedCsharpDir) {
    const runtime = path.resolve(repositoryRoot, "languages", "csharp", "src", "ScenarioKernel.Wpf", "ScenarioKernel.Wpf.csproj");
    return path.relative(projectedCsharpDir, runtime).replaceAll("/", "\\");
}
export function renderProgram() {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nusing ScenarioKernel.Adapters.Consumer;\nreturn await AdmittedConsumerPlatform.RunAsync("authority/application-binding.csharp.json", args);\n`;
}
export function renderSdkProject(adapterProjectRef) {
    return `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n  <ItemGroup>\n    <ProjectReference Include="${adapterProjectRef}" />\n  </ItemGroup>\n  <ItemGroup>\n    <Compile Remove="Program.generated.cs;ProjectedUiViewModel.generated.cs;avalonia\\**\\*.cs" />\n  </ItemGroup>\n  <ItemGroup>\n    <Content Include="..\\application-binding.csharp.json" Link="authority\\application-binding.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\capability.json" Link="authority\\capability.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\query\\conformance-query.csharp.json" Link="authority\\query\\conformance-query.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\fixtures\\fixtures.json" Link="authority\\fixtures\\fixtures.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\projection-conformance.json" Link="authority\\projection-conformance.json" CopyToOutputDirectory="PreserveNewest" Condition="Exists('..\\projection-conformance.json')" />\n  </ItemGroup>\n</Project>\n`;
}
export function renderCliProject(adapterProjectRef) {
    return `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net10.0</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n  <ItemGroup>\n    <ProjectReference Include="ProjectedConsumerSdk.generated.csproj" />\n    <ProjectReference Include="${adapterProjectRef}" />\n  </ItemGroup>\n  <ItemGroup>\n    <Compile Remove="ProjectedConsumerClient.generated.cs;ProjectedUiViewModel.generated.cs;avalonia\\**\\*.cs" />\n  </ItemGroup>\n</Project>\n`;
}
function records(value) {
    return Array.isArray(value) ? value : [];
}
function xml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}
function uiAuthority(input) {
    const binding = input.interfaceAuthority.interfaces.find((candidate) => candidate.kind === "ui" && (!candidate.projectionTargets || candidate.projectionTargets.includes("csharp")));
    if (!binding)
        return null;
    const configuration = binding.configuration;
    const authority = configuration?.authority;
    const authorityRef = configuration?.authorityRef;
    if (!authority || typeof authorityRef !== "string") {
        throw new Error(`Consumer UI interface '${binding.interfaceId}' has no materialized UI authority.`);
    }
    validateUiAuthority(authority, input.query);
    return { authorityRef, authority };
}
function validateUiAuthority(authority, query) {
    const interaction = authority.interactionAuthority;
    const presentation = authority.presentationProfile;
    const views = records(interaction.views);
    const startViewId = String(interaction.startViewId);
    if (!views.some((view) => view.viewId === startViewId)) {
        throw new Error(`Consumer UI authority start view '${startViewId}' is not declared.`);
    }
    if (!records(presentation.views).some((view) => view.viewId === startViewId)) {
        throw new Error(`Consumer UI presentation for start view '${startViewId}' is not declared.`);
    }
    if (records(interaction.navigation).length > 0) {
        throw new Error("MISSING_SDA_PLATFORM_CAPABILITY: WPF navigation projection is not admitted.");
    }
    const operations = records(interaction.operations);
    const operationIds = new Set(operations.map((operation) => String(operation.operationId)));
    const actions = records(interaction.actions);
    for (const action of actions) {
        if (!operationIds.has(String(action.operationId))) {
            throw new Error(`Consumer UI action '${String(action.actionId)}' references unknown operation '${String(action.operationId)}'.`);
        }
    }
    const queryCatalog = query.inspectableQueryCatalog;
    const queryIds = new Set(records(queryCatalog?.queries).map((definition) => String(definition.queryId)));
    for (const operation of operations) {
        if (operation.kind === "execute-query" && !queryIds.has(String(operation.queryId))) {
            throw new Error(`Consumer UI operation '${String(operation.operationId)}' references unknown query '${String(operation.queryId)}'.`);
        }
    }
    const definitions = new Map([
        ["information", new Set(records(interaction.information).map((item) => String(item.informationId)))],
        ["input", new Set(records(interaction.inputs).map((item) => String(item.inputId)))],
        ["action", new Set(actions.map((item) => String(item.actionId)))],
        ["collection", new Set(records(interaction.collections).map((item) => String(item.collectionId)))],
        ["feedback", new Set(records(interaction.feedback).map((item) => String(item.feedbackId)))]
    ]);
    const references = [
        ...views.flatMap((view) => records(view.members)),
        ...records(presentation.views).flatMap((view) => records(view.regions)).flatMap((region) => records(region.items))
    ];
    for (const reference of references) {
        if (!definitions.get(String(reference.semanticKind))?.has(String(reference.refId))) {
            throw new Error(`Consumer UI ${String(reference.semanticKind)} reference '${String(reference.refId)}' is not declared.`);
        }
    }
}
function definition(interaction, semanticKind, refId) {
    const collectionName = semanticKind === "information" ? "information"
        : semanticKind === "input" ? "inputs"
            : semanticKind === "action" ? "actions"
                : semanticKind === "collection" ? "collections"
                    : "feedback";
    const idName = `${semanticKind}Id`;
    const found = records(interaction[collectionName]).find((item) => String(item[idName]) === refId);
    if (!found)
        throw new Error(`Consumer UI ${semanticKind} '${refId}' is not declared.`);
    return found;
}
function accessibilityName(value, fallback) {
    const accessibility = value.accessibility;
    return xml(accessibility?.name ?? fallback);
}
function presentationIntent(presentation) {
    return presentation.intent;
}
function renderSemanticItem(reference, interaction, presentation) {
    const semanticKind = String(reference.semanticKind);
    const refId = String(reference.refId);
    const item = definition(interaction, semanticKind, refId);
    const label = xml(item.label);
    const automation = accessibilityName(item, item.label ?? refId);
    const intent = presentationIntent(presentation);
    const surfaces = intent.surfaces;
    const spacing = presentation.tokens.spacing;
    if (semanticKind === "information") {
        return `          <TextBlock Text="${xml(item.content)}" TextWrapping="Wrap" Style="{StaticResource SdaSupportingTextStyle}" AutomationProperties.AutomationId="sda-information:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="hierarchy:supporting;typography:supporting" />`;
    }
    if (semanticKind === "input") {
        const inputIntent = String(item.inputIntent);
        if (!["text", "structured-text", "file-selection"].includes(inputIntent)) {
            throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: WPF input intent '${inputIntent}' is unsupported.`);
        }
        if (inputIntent === "file-selection") {
            const accepted = records(item.acceptedFileTypes).map(String).join(",");
            const commit = typeof item.commitOperationId === "string" && item.commitOperationId.length > 0
                ? ` CommitCommand="{Binding OperationCommands[${xml(item.commitOperationId)}]}"` : "";
            const commitHelp = typeof item.commitOperationId === "string" && item.commitOperationId.length > 0
                ? `;commit-operation:${xml(item.commitOperationId)}` : "";
            return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <wpf:AuthorityFileInput SerializedDocument="{Binding Inputs[${xml(item.stateId)}], Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" AcceptedFileTypes="${xml(accepted)}"${commit} AutomationProperties.AutomationId="sda-input:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.control)};typography:body;focus:${xml(intent.focus)};input-intent:file-selection${commitHelp}" />\n          </StackPanel>`;
        }
        const structured = inputIntent === "structured-text";
        return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <TextBox Text="{Binding Inputs[${xml(item.stateId)}], UpdateSourceTrigger=PropertyChanged}"${structured ? ' AcceptsReturn="True" TextWrapping="NoWrap" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Auto" MinHeight="180" FontFamily="Consolas"' : ""} AutomationProperties.AutomationId="sda-input:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.control)};typography:body;focus:${xml(intent.focus)}" />\n          </StackPanel>`;
    }
    if (semanticKind === "action") {
        const emphasis = intent.actionEmphasis[String(item.importance)];
        const style = item.importance === "primary" ? "SdaPrimaryActionStyle"
            : item.importance === "destructive" ? "SdaDestructiveActionStyle" : "SdaSecondaryActionStyle";
        return `            <Button Content="${label}" Command="{Binding Commands[${xml(item.actionId)}]}" Style="{StaticResource ${style}}" AutomationProperties.AutomationId="sda-action:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="action-emphasis:${xml(emphasis)};state-disabled:${xml(intent.stateDistinction.disabled)};focus:${xml(intent.focus)};adaptation:${xml(presentation.adaptation.actionFlow)}" />`;
    }
    if (semanticKind === "feedback") {
        const state = records(interaction.stateBindings).find((candidate) => candidate.stateId === item.stateId);
        const source = state?.source === "outcome" ? `StateValues[${xml(item.stateId)}]`
            : state?.source === "user-input" ? `Inputs[${xml(item.stateId)}]`
                : state?.source === "query-result" ? "QueryResultJson"
                    : state?.source === "execution-error" ? "Error"
                        : state?.source === "execution-result" ? "ResultJson"
                            : state?.source === "execution-status" ? "Status"
                                : null;
        if (!source)
            throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: WPF feedback state '${String(item.stateId)}' is unsupported.`);
        const accessibility = item.accessibility;
        const live = accessibility.live === "assertive" ? ' AutomationProperties.LiveSetting="Assertive"'
            : accessibility.live === "polite" ? ' AutomationProperties.LiveSetting="Polite"' : "";
        if (item.feedbackIntent === "status") {
            return `          <Border Style="{StaticResource SdaStatusSurfaceStyle}">\n            <StackPanel>\n              <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n              <TextBlock Text="{Binding ${source}}" FontWeight="SemiBold" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.status)};state-distinction:${xml(intent.stateDistinction.status)}" AutomationProperties.ItemStatus="{Binding ${source}}"${live} />\n            </StackPanel>\n          </Border>`;
        }
        if (item.feedbackIntent === "error") {
            return `          <Border Style="{StaticResource SdaErrorSurfaceStyle}">\n            <StackPanel>\n              <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" Foreground="{StaticResource SdaErrorAccentBrush}" />\n              <TextBlock Text="{Binding ${source}}" TextWrapping="Wrap" Foreground="{StaticResource SdaErrorAccentBrush}" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.error)};state-distinction:${xml(intent.stateDistinction.error)}" AutomationProperties.ItemStatus="{Binding ${source}}"${live} />\n            </StackPanel>\n          </Border>`;
        }
        if (item.feedbackIntent === "document") {
            return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <Border Background="#D8D8D8" Padding="20" CornerRadius="${xml(presentation.tokens.shape.controlRadius)}">\n              <wpf:AuthorityDocumentSurface Html="{Binding ${source}, Mode=OneWay}" Height="900" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.document)};media:semantically-required" AutomationProperties.ItemStatus="{Binding ${source}}" />\n            </Border>\n          </StackPanel>`;
        }
        if (item.presentationIntent && item.presentationIntent !== "plain") {
            return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <wpf:AuthorityStructuredSurface Json="{Binding ${source}, Mode=OneWay}" Intent="${xml(item.presentationIntent)}" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.result)};presentation-intent:${xml(item.presentationIntent)}" AutomationProperties.ItemStatus="{Binding ${source}}"${live} />\n          </StackPanel>`;
        }
        return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <TextBox Text="{Binding ${source}, Mode=OneWay}" IsReadOnly="True" AcceptsReturn="True" TextWrapping="NoWrap" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Auto" MinHeight="120" Background="{StaticResource SdaSupportingSurfaceBrush}" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.result)};typography:body" AutomationProperties.ItemStatus="{Binding ${source}}"${live} />\n          </StackPanel>`;
    }
    if (semanticKind === "collection") {
        if (item.presentationIntent && item.presentationIntent !== "tabular") {
            const fieldSpec = records(item.fields).map((field) => `${String(field.fieldId)}|${String(field.label)}`).join(";");
            return `          <StackPanel Margin="0,0,0,${xml(spacing.lg)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <wpf:AuthorityCollectionSurface Rows="{Binding Collections[${xml(item.collectionId)}]}" Intent="${xml(item.presentationIntent)}" FieldSpec="${xml(fieldSpec)}" AutomationProperties.AutomationId="sda-collection:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.collection)};presentation-intent:${xml(item.presentationIntent)};adaptation:${xml(presentation.adaptation.collectionOverflow)}" />\n          </StackPanel>`;
        }
        const columns = records(item.fields).map((field) => `              <DataGridTextColumn Header="${xml(field.label)}" Binding="{Binding Values[${xml(field.fieldId)}]}" />`).join("\n");
        return `          <StackPanel Margin="0,0,0,${xml(spacing.lg)}">\n            <TextBlock Text="${label}" Style="{StaticResource SdaLabelStyle}" />\n            <DataGrid ItemsSource="{Binding Collections[${xml(item.collectionId)}]}" AutoGenerateColumns="False" IsReadOnly="True" CanUserAddRows="False" MinHeight="160" AutomationProperties.AutomationId="sda-collection:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.collection)};adaptation:${xml(presentation.adaptation.collectionOverflow)}">\n              <DataGrid.Columns>\n${columns}\n              </DataGrid.Columns>\n            </DataGrid>\n          </StackPanel>`;
    }
    throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: UI semantic kind '${semanticKind}' is unsupported.`);
}
export function renderWpfApp() {
    return `<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<Application x:Class="Sda.ProjectedConsumer.App"\n             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"\n             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n             StartupUri="MainWindow.generated.xaml">\n  <Application.Resources />\n</Application>\n`;
}
export function renderWpfWindow(authority) {
    const interaction = authority.interactionAuthority;
    const presentation = authority.presentationProfile;
    const viewDefinition = records(interaction.views).find((candidate) => candidate.viewId === interaction.startViewId);
    const profileView = records(presentation.views).find((candidate) => candidate.viewId === interaction.startViewId);
    if (!viewDefinition || !profileView)
        throw new Error(`Consumer UI authority start view '${String(interaction.startViewId)}' is incomplete.`);
    if (!["stack", "column", "workspace"].includes(String(profileView.layoutIntent))) {
        throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: WPF view layout intent '${String(profileView.layoutIntent)}' is unsupported.`);
    }
    const [width, height] = profileView.sizeIntent === "workspace" ? [1500, 960]
        : profileView.sizeIntent === "compact" ? [700, 520] : [900, 700];
    const view = { ...viewDefinition, title: authority.title, width, height };
    const tokens = presentation.tokens;
    const colors = tokens.colors;
    const spacing = tokens.spacing;
    const typography = tokens.typography;
    const shape = tokens.shape;
    const weight = (role) => {
        const value = (typography[role].weight);
        return value === "strong" ? "Bold" : value === "medium" ? "SemiBold" : "Normal";
    };
    const size = (role) => typography[role].size;
    const regionEntries = records(profileView.regions).map((region) => {
        const groups = [];
        let actionRun = [];
        const flushActions = () => {
            if (actionRun.length === 0)
                return;
            groups.push(`          <WrapPanel Margin="0,0,0,${xml(spacing.sm)}" AutomationProperties.HelpText="adaptation:${xml(presentation.adaptation.actionFlow)}">\n${actionRun.map((item) => renderSemanticItem(item, interaction, presentation)).join("\n")}\n          </WrapPanel>`);
            actionRun = [];
        };
        for (const item of records(region.items)) {
            if (item.semanticKind === "action")
                actionRun.push(item);
            else {
                flushActions();
                groups.push(renderSemanticItem(item, interaction, presentation));
            }
        }
        flushActions();
        const items = groups.join("\n");
        const isRow = ["row", "primary-action-region"].includes(String(region.layoutIntent));
        const panel = isRow ? "WrapPanel" : "StackPanel";
        const role = String(region.role ?? "primary-content");
        const placement = profileView.layoutIntent === "workspace" ? {
            navigation: 'Grid.Column="0" Grid.Row="0" Grid.RowSpan="6" Margin="0,0,18,0"',
            hero: 'Grid.Column="1" Grid.Row="0" Grid.ColumnSpan="2" Margin="0,0,0,18"',
            context: 'Grid.Column="1" Grid.Row="1" Margin="0,0,18,18"',
            summary: 'Grid.Column="2" Grid.Row="1" Margin="0,0,0,18"',
            "primary-content": 'Grid.Column="1" Grid.Row="2" Grid.RowSpan="2" Margin="0,0,18,18"',
            document: 'Grid.Column="2" Grid.Row="2" Margin="0,0,0,18"',
            assurance: 'Grid.Column="2" Grid.Row="3" Margin="0,0,0,18"',
            proof: 'Grid.Column="1" Grid.Row="4" Grid.ColumnSpan="2" Margin="0,0,0,18"',
            actions: 'Grid.Column="1" Grid.Row="5" Grid.ColumnSpan="2" Margin="0"'
        }[role] ?? 'Grid.Column="1" Grid.Row="5" Grid.ColumnSpan="2" Margin="0,0,0,18"' : "";
        const style = "SdaPanelStyle";
        return { role, content: `      <Border Style="{StaticResource ${style}}" ${placement} AutomationProperties.HelpText="role:${xml(role)};importance:${xml(region.importance ?? "secondary")}">\n        <StackPanel>\n          <TextBlock Text="${xml(region.title)}" Style="{StaticResource SdaRegionTitleStyle}" AutomationProperties.AutomationId="sda-region:${xml(region.regionId)}" AutomationProperties.Name="${xml(region.title)}" AutomationProperties.HelpText="hierarchy:${xml(presentation.intent.hierarchy && presentation.intent.hierarchy.regionTitle)};grouping:${xml(region.layoutIntent)};surface:${xml(presentation.intent.surfaces.region)};role:${xml(role)}" />\n          <${panel}>\n${items}\n          </${panel}>\n        </StackPanel>\n      </Border>` };
    });
    const sections = profileView.layoutIntent === "workspace"
        ? `      <Grid>\n        <Grid.ColumnDefinitions><ColumnDefinition Width="260" /><ColumnDefinition Width="1.05*" /><ColumnDefinition Width="0.95*" /></Grid.ColumnDefinitions>\n        <Grid.RowDefinitions><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /></Grid.RowDefinitions>\n${regionEntries.map((entry) => entry.content).join("\n")}\n      </Grid>`
        : regionEntries.map((entry) => entry.content).join("\n");
    return `<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<Window x:Class="Sda.ProjectedConsumer.MainWindow"\n        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"\n        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n        xmlns:projected="clr-namespace:Sda.ProjectedConsumer"\n        Title="${xml(view.title ?? authority.title)}" Width="${xml(view.width)}" Height="${xml(view.height)}" MinWidth="360" MinHeight="520"\n        Background="${xml(colors.pageSurface)}" Foreground="${xml(colors.textPrimary)}" FontFamily="Segoe UI" FontSize="${xml(size("body"))}"\n        WindowStartupLocation="CenterScreen" AutomationProperties.AutomationId="sda-view:${xml(profileView.viewId)}" AutomationProperties.HelpText="platform-adaptation:${xml(presentation.intent.platformAdaptation)}">\n  <Window.Resources>\n    <SolidColorBrush x:Key="SdaPageSurfaceBrush" Color="${xml(colors.pageSurface)}" />\n    <SolidColorBrush x:Key="SdaContentSurfaceBrush" Color="${xml(colors.contentSurface)}" />\n    <SolidColorBrush x:Key="SdaSupportingSurfaceBrush" Color="${xml(colors.supportingSurface)}" />\n    <SolidColorBrush x:Key="SdaBorderBrush" Color="${xml(colors.border)}" />\n    <SolidColorBrush x:Key="SdaTextPrimaryBrush" Color="${xml(colors.textPrimary)}" />\n    <SolidColorBrush x:Key="SdaTextSupportingBrush" Color="${xml(colors.textSupporting)}" />\n    <SolidColorBrush x:Key="SdaPrimaryActionBrush" Color="${xml(colors.primaryAction)}" />\n    <SolidColorBrush x:Key="SdaPrimaryActionContentBrush" Color="${xml(colors.primaryActionContent)}" />\n    <SolidColorBrush x:Key="SdaSecondaryActionBrush" Color="${xml(colors.secondaryAction)}" />\n    <SolidColorBrush x:Key="SdaSecondaryActionContentBrush" Color="${xml(colors.secondaryActionContent)}" />\n    <SolidColorBrush x:Key="SdaDestructiveActionBrush" Color="${xml(colors.destructiveAction)}" />\n    <SolidColorBrush x:Key="SdaDestructiveActionContentBrush" Color="${xml(colors.destructiveActionContent)}" />\n    <SolidColorBrush x:Key="SdaStatusSurfaceBrush" Color="${xml(colors.statusSurface)}" />\n    <SolidColorBrush x:Key="SdaStatusAccentBrush" Color="${xml(colors.statusAccent)}" />\n    <SolidColorBrush x:Key="SdaErrorSurfaceBrush" Color="${xml(colors.errorSurface)}" />\n    <SolidColorBrush x:Key="SdaErrorAccentBrush" Color="${xml(colors.errorAccent)}" />\n    <SolidColorBrush x:Key="SdaFocusBrush" Color="${xml(colors.focus)}" />\n    <system:Double x:Key="SdaSpaceXs" xmlns:system="clr-namespace:System;assembly=System.Runtime">${xml(spacing.xs)}</system:Double>\n    <system:Double x:Key="SdaSpaceSm" xmlns:system="clr-namespace:System;assembly=System.Runtime">${xml(spacing.sm)}</system:Double>\n    <system:Double x:Key="SdaSpaceMd" xmlns:system="clr-namespace:System;assembly=System.Runtime">${xml(spacing.md)}</system:Double>\n    <system:Double x:Key="SdaSpaceLg" xmlns:system="clr-namespace:System;assembly=System.Runtime">${xml(spacing.lg)}</system:Double>\n    <system:Double x:Key="SdaSpaceXl" xmlns:system="clr-namespace:System;assembly=System.Runtime">${xml(spacing.xl)}</system:Double>\n    <Style x:Key="SdaPageTitleStyle" TargetType="TextBlock">\n      <Setter Property="FontSize" Value="${xml(size("display"))}" /><Setter Property="FontWeight" Value="${weight("display")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Margin" Value="0,0,0,{StaticResource SdaSpaceXs}" />\n    </Style>\n    <Style x:Key="SdaRegionTitleStyle" TargetType="TextBlock">\n      <Setter Property="FontSize" Value="${xml(size("section"))}" /><Setter Property="FontWeight" Value="${weight("section")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Margin" Value="0,0,0,{StaticResource SdaSpaceMd}" />\n    </Style>\n    <Style x:Key="SdaLabelStyle" TargetType="TextBlock">\n      <Setter Property="FontSize" Value="${xml(size("label"))}" /><Setter Property="FontWeight" Value="${weight("label")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Margin" Value="0,0,0,{StaticResource SdaSpaceXs}" />\n    </Style>\n    <Style x:Key="SdaSupportingTextStyle" TargetType="TextBlock">\n      <Setter Property="FontSize" Value="${xml(size("supporting"))}" /><Setter Property="FontWeight" Value="${weight("supporting")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextSupportingBrush}" /><Setter Property="Margin" Value="0,0,0,{StaticResource SdaSpaceMd}" />\n    </Style>\n    <Style x:Key="SdaPanelStyle" TargetType="Border">\n      <Setter Property="Background" Value="{StaticResource SdaContentSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaBorderBrush}" /><Setter Property="BorderThickness" Value="1" /><Setter Property="CornerRadius" Value="${xml(shape.panelRadius)}" /><Setter Property="Padding" Value="${xml(spacing.lg)}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.lg)}" />\n      <Setter Property="Effect"><Setter.Value><DropShadowEffect BlurRadius="16" ShadowDepth="2" Opacity="0.08" /></Setter.Value></Setter>\n    </Style>\n    <Style TargetType="TextBox">\n      <Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Background" Value="{StaticResource SdaContentSurfaceBrush}" /><Setter Property="BorderBrush" Value="#AEBBD0" /><Setter Property="BorderThickness" Value="1" /><Setter Property="Padding" Value="10,8" /><Setter Property="MinHeight" Value="38" />\n      <Style.Triggers><Trigger Property="IsKeyboardFocused" Value="True"><Setter Property="BorderBrush" Value="{StaticResource SdaFocusBrush}" /><Setter Property="BorderThickness" Value="2" /></Trigger></Style.Triggers>\n    </Style>\n    <Style x:Key="SdaActionStyle" TargetType="Button">\n      <Setter Property="Padding" Value="14,9" /><Setter Property="Margin" Value="0,0,${xml(spacing.sm)},${xml(spacing.sm)}" /><Setter Property="MinHeight" Value="38" /><Setter Property="BorderThickness" Value="1" /><Setter Property="BorderBrush" Value="Transparent" /><Setter Property="HorizontalAlignment" Value="Left" />\n      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button"><Border x:Name="ActionBorder" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="${xml(shape.controlRadius)}" Padding="{TemplateBinding Padding}"><ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center" /></Border><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="ActionBorder" Property="Opacity" Value="0.9" /></Trigger><Trigger Property="IsEnabled" Value="False"><Setter TargetName="ActionBorder" Property="Opacity" Value="0.45" /></Trigger><Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="ActionBorder" Property="BorderBrush" Value="{StaticResource SdaFocusBrush}" /><Setter TargetName="ActionBorder" Property="BorderThickness" Value="2" /></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter>\n    </Style>\n    <Style x:Key="SdaPrimaryActionStyle" TargetType="Button" BasedOn="{StaticResource SdaActionStyle}"><Setter Property="Background" Value="{StaticResource SdaPrimaryActionBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaPrimaryActionContentBrush}" /></Style>\n    <Style x:Key="SdaSecondaryActionStyle" TargetType="Button" BasedOn="{StaticResource SdaActionStyle}"><Setter Property="Background" Value="{StaticResource SdaSecondaryActionBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaSecondaryActionContentBrush}" /></Style>\n    <Style x:Key="SdaDestructiveActionStyle" TargetType="Button" BasedOn="{StaticResource SdaActionStyle}"><Setter Property="Background" Value="{StaticResource SdaDestructiveActionBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaDestructiveActionContentBrush}" /></Style>\n    <Style x:Key="SdaStatusSurfaceStyle" TargetType="Border"><Setter Property="Background" Value="{StaticResource SdaStatusSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaStatusAccentBrush}" /><Setter Property="BorderThickness" Value="4,0,0,0" /><Setter Property="Padding" Value="${xml(spacing.md)},${xml(spacing.sm)}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.md)}" /></Style>\n    <Style x:Key="SdaErrorSurfaceStyle" TargetType="Border"><Setter Property="Background" Value="{StaticResource SdaErrorSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaErrorAccentBrush}" /><Setter Property="BorderThickness" Value="1" /><Setter Property="CornerRadius" Value="${xml(shape.controlRadius)}" /><Setter Property="Padding" Value="${xml(spacing.md)}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.md)}" /></Style>\n    <Style TargetType="DataGrid"><Setter Property="Background" Value="{StaticResource SdaContentSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaBorderBrush}" /><Setter Property="BorderThickness" Value="1" /><Setter Property="GridLinesVisibility" Value="Horizontal" /><Setter Property="HorizontalGridLinesBrush" Value="{StaticResource SdaBorderBrush}" /><Setter Property="HeadersVisibility" Value="Column" /><Setter Property="RowHeight" Value="36" /><Setter Property="ColumnHeaderHeight" Value="38" /><Setter Property="AlternatingRowBackground" Value="{StaticResource SdaSupportingSurfaceBrush}" /></Style>\n    <Style TargetType="DataGridColumnHeader"><Setter Property="Background" Value="{StaticResource SdaSupportingSurfaceBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="FontWeight" Value="SemiBold" /><Setter Property="Padding" Value="10,8" /></Style>\n    <Style TargetType="DataGridCell"><Setter Property="Padding" Value="10,7" /><Setter Property="BorderThickness" Value="0" /></Style>\n  </Window.Resources>\n  <Window.DataContext>\n    <projected:ProjectedUiViewModel />\n  </Window.DataContext>\n  <ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">\n    <StackPanel Margin="${xml(spacing.xl)}" MaxWidth="1480" HorizontalAlignment="Stretch">\n      <TextBlock Text="${xml(authority.title)}" Style="{StaticResource SdaPageTitleStyle}" AutomationProperties.AutomationId="sda-presentation:page-title" AutomationProperties.Name="${xml(authority.title)}" AutomationProperties.HelpText="hierarchy:${xml(presentation.intent.hierarchy.pageTitle)};typography:display" />\n      <TextBlock Text="${xml(authority.experienceAuthority.promise)}" Style="{StaticResource SdaSupportingTextStyle}" AutomationProperties.AutomationId="sda-presentation:experience-promise" AutomationProperties.Name="${xml(authority.experienceAuthority.promise)}" />\n${sections}\n    </StackPanel>\n  </ScrollViewer>\n</Window>\n`;
}
function realizeScalarPresentationResources(xaml, authority) {
    const presentation = authority.presentationProfile;
    const spacing = presentation.tokens.spacing;
    const intent = presentation.intent;
    const motion = intent.motion;
    const stateDistinction = intent.stateDistinction;
    const adaptation = presentation.adaptation;
    const windowIntent = [
        `platform-adaptation:${String(intent.platformAdaptation)}`,
        `density:${String(presentation.density)}`,
        `state-disabled:${String(stateDistinction.disabled)}`,
        `state-status:${String(stateDistinction.status)}`,
        `state-error:${String(stateDistinction.error)}`,
        `adaptation:${String(adaptation.actionFlow)}+${String(adaptation.collectionOverflow)}`,
        `focus:${String(intent.focus)}`,
        `media:${String(intent.media)}`,
        `motion:${String(motion.stateChange)}+${String(motion.reducedMotionBehavior)}`
    ].join(";");
    return Object.entries({ SdaSpaceXs: spacing.xs, SdaSpaceSm: spacing.sm, SdaSpaceMd: spacing.md, SdaSpaceLg: spacing.lg, SdaSpaceXl: spacing.xl })
        .reduce((result, [key, value]) => result.replaceAll(`{StaticResource ${key}}`, String(value)), xaml)
        .replace('xmlns:projected="clr-namespace:Sda.ProjectedConsumer"', 'xmlns:projected="clr-namespace:Sda.ProjectedConsumer"\n        xmlns:wpf="clr-namespace:ScenarioKernel.Wpf;assembly=ScenarioKernel.Wpf"')
        .replace(`AutomationProperties.HelpText="platform-adaptation:${String(intent.platformAdaptation)}"`, `AutomationProperties.HelpText="${windowIntent}"`)
        .replace(`<ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">`, `<ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled" AutomationProperties.AutomationId="sda-presentation:application" AutomationProperties.HelpText="${windowIntent}">`)
        .replace(/^    <system:Double[^\n]*\n/gmu, "");
}
export function renderProjectedUiViewModel() {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\n#nullable enable\nusing System.IO;\nusing ScenarioKernel.Wpf;\n\nnamespace Sda.ProjectedConsumer;\n\npublic sealed class ProjectedUiViewModel : AuthorityBackedViewModel\n{\n    public ProjectedUiViewModel()\n        : base(\n            Path.Combine(AppContext.BaseDirectory, "authority", "application-binding.csharp.json"),\n            Path.Combine(AppContext.BaseDirectory, "authority", "ui-authority.csharp.json"))\n    {\n    }\n}\n`;
}
export function renderWpfProject(wpfProjectRef) {
    return `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>WinExe</OutputType>\n    <TargetFramework>net10.0-windows</TargetFramework>\n    <UseWPF>true</UseWPF>\n    <EnableWindowsTargeting>true</EnableWindowsTargeting>\n    <EnableDefaultApplicationDefinition>false</EnableDefaultApplicationDefinition>\n    <EnableDefaultPageItems>false</EnableDefaultPageItems>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n  <ItemGroup>\n    <ProjectReference Include="${wpfProjectRef}" />\n  </ItemGroup>\n  <ItemGroup>\n    <Compile Remove="Program.generated.cs;ProjectedConsumerClient.generated.cs;avalonia\\**\\*.cs" />\n    <ApplicationDefinition Include="App.generated.xaml" />\n    <Page Include="MainWindow.generated.xaml" />\n  </ItemGroup>\n  <ItemGroup>\n    <Content Include="..\\application-binding.csharp.json" Link="authority\\application-binding.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\capability.json" Link="authority\\capability.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\query\\conformance-query.csharp.json" Link="authority\\query\\conformance-query.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\fixtures\\fixtures.json" Link="authority\\fixtures\\fixtures.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="ui\\ui-authority.csharp.json" Link="authority\\ui-authority.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\projection-conformance.json" Link="authority\\projection-conformance.json" CopyToOutputDirectory="PreserveNewest" Condition="Exists('..\\projection-conformance.json')" />\n  </ItemGroup>\n</Project>\n`;
}
export function resolveAvaloniaProjectRef(repositoryRoot, projectedAvaloniaDir) {
    const runtime = path.resolve(repositoryRoot, "languages", "csharp", "src", "ScenarioKernel.Avalonia", "ScenarioKernel.Avalonia.csproj");
    return path.relative(projectedAvaloniaDir, runtime).replaceAll("/", "\\");
}
export function resolveUiAuthorityProjectRef(repositoryRoot, projectedAvaloniaDir) {
    const runtime = path.resolve(repositoryRoot, "languages", "csharp", "src", "ScenarioKernel.UiAuthority", "ScenarioKernel.UiAuthority.csproj");
    return path.relative(projectedAvaloniaDir, runtime).replaceAll("/", "\\");
}
function requiresAvaloniaCustomSurfaces(authority) {
    const interaction = authority.interactionAuthority;
    return records(interaction.inputs).some((input) => input.inputIntent === "file-selection") ||
        records(interaction.collections).length > 0 ||
        records(interaction.feedback).some((feedback) => feedback.feedbackIntent === "document" ||
            (typeof feedback.presentationIntent === "string" && feedback.presentationIntent !== "plain"));
}
export function renderAvaloniaApp() {
    return `<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<Application x:Class="Sda.ProjectedConsumer.App"\n             xmlns="https://github.com/avaloniaui"\n             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">\n  <Application.Styles>\n    <FluentTheme />\n  </Application.Styles>\n</Application>\n`;
}
export function renderAvaloniaAppCodeBehind() {
    return `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\nusing Avalonia;\nusing Avalonia.Controls.ApplicationLifetimes;\nusing Avalonia.Markup.Xaml;\n\nnamespace Sda.ProjectedConsumer;\n\npublic partial class App : Application\n{\n    public override void Initialize() => AvaloniaXamlLoader.Load(this);\n\n    public override void OnFrameworkInitializationCompleted()\n    {\n        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop) desktop.MainWindow = new MainWindow();\n        base.OnFrameworkInitializationCompleted();\n    }\n}\n`;
}
export function renderAvaloniaProgram() {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nusing Avalonia;\n\nnamespace Sda.ProjectedConsumer;\n\ninternal static class AvaloniaProgram\n{\n    [STAThread]\n    public static void Main(string[] args) => BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);\n\n    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>().UsePlatformDetect().LogToTrace();\n}\n`;
}
export function renderAvaloniaWindowCodeBehind() {
    return `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\nusing Avalonia.Controls;\n\nnamespace Sda.ProjectedConsumer;\n\npublic partial class MainWindow : Window\n{\n    public MainWindow() => InitializeComponent();\n}\n`;
}
function renderAvaloniaSemanticItem(reference, interaction, presentation) {
    const semanticKind = String(reference.semanticKind);
    const refId = String(reference.refId);
    const item = definition(interaction, semanticKind, refId);
    const label = xml(item.label);
    const automation = accessibilityName(item, item.label ?? refId);
    const intent = presentationIntent(presentation);
    const surfaces = intent.surfaces;
    const spacing = presentation.tokens.spacing;
    if (semanticKind === "information") {
        return `          <TextBlock Text="${xml(item.content)}" TextWrapping="Wrap" Classes="sda-supporting-text" AutomationProperties.AutomationId="sda-information:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="hierarchy:supporting;typography:supporting" />`;
    }
    if (semanticKind === "input") {
        const inputIntent = String(item.inputIntent);
        if (!["text", "structured-text", "file-selection"].includes(inputIntent)) {
            throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: Avalonia input intent '${inputIntent}' is unsupported.`);
        }
        if (inputIntent === "file-selection") {
            const accepted = records(item.acceptedFileTypes).map(String).join(",");
            const commit = typeof item.commitOperationId === "string" && item.commitOperationId.length > 0
                ? ` CommitCommand="{Binding OperationCommands[${xml(item.commitOperationId)}]}"` : "";
            const commitHelp = typeof item.commitOperationId === "string" && item.commitOperationId.length > 0
                ? `;commit-operation:${xml(item.commitOperationId)}` : "";
            return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <avalonia:AuthorityFileInput SerializedDocument="{Binding Inputs[${xml(item.stateId)}], Mode=TwoWay}" AcceptedFileTypes="${xml(accepted)}"${commit} AutomationProperties.AutomationId="sda-input:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.control)};typography:body;focus:${xml(intent.focus)};input-intent:file-selection${commitHelp}" />\n          </StackPanel>`;
        }
        const structured = inputIntent === "structured-text";
        return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <TextBox Text="{Binding Inputs[${xml(item.stateId)}]}"${structured ? ' AcceptsReturn="True" TextWrapping="NoWrap" MinHeight="180" FontFamily="Consolas"' : ""} AutomationProperties.AutomationId="sda-input:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.control)};typography:body;focus:${xml(intent.focus)}" />\n          </StackPanel>`;
    }
    if (semanticKind === "action") {
        const emphasis = intent.actionEmphasis[String(item.importance)];
        const classes = item.importance === "primary" ? "sda-action sda-action-primary"
            : item.importance === "destructive" ? "sda-action sda-action-destructive" : "sda-action sda-action-secondary";
        return `            <Button Content="${label}" Command="{Binding Commands[${xml(item.actionId)}]}" Classes="${classes}" AutomationProperties.AutomationId="sda-action:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="action-emphasis:${xml(emphasis)};state-disabled:${xml(intent.stateDistinction.disabled)};focus:${xml(intent.focus)};adaptation:${xml(presentation.adaptation.actionFlow)}" />`;
    }
    if (semanticKind === "feedback") {
        const state = records(interaction.stateBindings).find((candidate) => candidate.stateId === item.stateId);
        const source = state?.source === "outcome" ? `StateValues[${xml(item.stateId)}]`
            : state?.source === "user-input" ? `Inputs[${xml(item.stateId)}]`
                : state?.source === "query-result" ? "QueryResultJson"
                    : state?.source === "execution-error" ? "Error"
                        : state?.source === "execution-result" ? "ResultJson"
                            : state?.source === "execution-status" ? "Status"
                                : null;
        if (!source)
            throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: Avalonia feedback state '${String(item.stateId)}' is unsupported.`);
        const accessibility = item.accessibility;
        const live = accessibility.live === "assertive" ? ' AutomationProperties.LiveSetting="Assertive"'
            : accessibility.live === "polite" ? ' AutomationProperties.LiveSetting="Polite"' : "";
        if (item.feedbackIntent === "status") {
            return `          <Border Classes="sda-status-surface">\n            <StackPanel>\n              <TextBlock Text="${label}" Classes="sda-label" />\n              <TextBlock Text="{Binding ${source}}" FontWeight="SemiBold" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.status)};state-distinction:${xml(intent.stateDistinction.status)}"${live} />\n            </StackPanel>\n          </Border>`;
        }
        if (item.feedbackIntent === "error") {
            return `          <Border Classes="sda-error-surface">\n            <StackPanel>\n              <TextBlock Text="${label}" Classes="sda-label sda-error-text" />\n              <TextBlock Text="{Binding ${source}}" TextWrapping="Wrap" Classes="sda-error-text" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.error)};state-distinction:${xml(intent.stateDistinction.error)}"${live} />\n            </StackPanel>\n          </Border>`;
        }
        if (item.feedbackIntent === "document") {
            return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <Border Background="#D8D8D8" Padding="20" CornerRadius="${xml(presentation.tokens.shape.controlRadius)}">\n              <avalonia:AuthorityDocumentSurface Html="{Binding ${source}}" Height="900" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.document)};media:semantically-required" />\n            </Border>\n          </StackPanel>`;
        }
        if (item.presentationIntent && item.presentationIntent !== "plain") {
            return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <avalonia:AuthorityStructuredSurface Json="{Binding ${source}}" Intent="${xml(item.presentationIntent)}" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.result)};presentation-intent:${xml(item.presentationIntent)}"${live} />\n          </StackPanel>`;
        }
        return `          <StackPanel Margin="0,0,0,${xml(spacing.md)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <TextBox Text="{Binding ${source}}" IsReadOnly="True" AcceptsReturn="True" TextWrapping="NoWrap" MinHeight="120" Classes="sda-readonly-surface" AutomationProperties.AutomationId="sda-feedback:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.result)};typography:body"${live} />\n          </StackPanel>`;
    }
    if (semanticKind === "collection") {
        if (item.presentationIntent && item.presentationIntent !== "tabular") {
            const fieldSpec = records(item.fields).map((field) => `${String(field.fieldId)}|${String(field.label)}`).join(";");
            return `          <StackPanel Margin="0,0,0,${xml(spacing.lg)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <avalonia:AuthorityCollectionSurface Rows="{Binding Collections[${xml(item.collectionId)}]}" Intent="${xml(item.presentationIntent)}" FieldSpec="${xml(fieldSpec)}" AutomationProperties.AutomationId="sda-collection:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.collection)};presentation-intent:${xml(item.presentationIntent)};adaptation:${xml(presentation.adaptation.collectionOverflow)}" />\n          </StackPanel>`;
        }
        const tabularFieldSpec = records(item.fields).map((field) => `${String(field.fieldId)}|${String(field.label)}`).join(";");
        return `          <StackPanel Margin="0,0,0,${xml(spacing.lg)}">\n            <TextBlock Text="${label}" Classes="sda-label" />\n            <avalonia:AuthorityCollectionSurface Rows="{Binding Collections[${xml(item.collectionId)}]}" Intent="tabular" FieldSpec="${xml(tabularFieldSpec)}" AutomationProperties.AutomationId="sda-collection:${xml(refId)}" AutomationProperties.Name="${automation}" AutomationProperties.HelpText="surface:${xml(surfaces.collection)};adaptation:${xml(presentation.adaptation.collectionOverflow)}" />\n          </StackPanel>`;
    }
    throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: UI semantic kind '${semanticKind}' is unsupported.`);
}
export function renderAvaloniaWindow(authority) {
    const interaction = authority.interactionAuthority;
    const presentation = authority.presentationProfile;
    const viewDefinition = records(interaction.views).find((candidate) => candidate.viewId === interaction.startViewId);
    const profileView = records(presentation.views).find((candidate) => candidate.viewId === interaction.startViewId);
    if (!viewDefinition || !profileView)
        throw new Error(`Consumer UI authority start view '${String(interaction.startViewId)}' is incomplete.`);
    if (!["stack", "column", "workspace"].includes(String(profileView.layoutIntent))) {
        throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: Avalonia view layout intent '${String(profileView.layoutIntent)}' is unsupported.`);
    }
    const [width, height] = profileView.sizeIntent === "workspace" ? [1500, 960]
        : profileView.sizeIntent === "compact" ? [700, 520] : [900, 700];
    const view = { ...viewDefinition, title: authority.title, width, height };
    const tokens = presentation.tokens;
    const colors = tokens.colors;
    const spacing = tokens.spacing;
    const typography = tokens.typography;
    const shape = tokens.shape;
    const weight = (role) => {
        const value = (typography[role].weight);
        return value === "strong" ? "Bold" : value === "medium" ? "SemiBold" : "Normal";
    };
    const size = (role) => typography[role].size;
    const intent = presentation.intent;
    const motion = intent.motion;
    const stateDistinction = intent.stateDistinction;
    const adaptation = presentation.adaptation;
    const windowIntent = [
        `platform-adaptation:${String(intent.platformAdaptation)}`,
        `density:${String(presentation.density)}`,
        `state-disabled:${String(stateDistinction.disabled)}`,
        `state-status:${String(stateDistinction.status)}`,
        `state-error:${String(stateDistinction.error)}`,
        `adaptation:${String(adaptation.actionFlow)}+${String(adaptation.collectionOverflow)}`,
        `focus:${String(intent.focus)}`,
        `media:${String(intent.media)}`,
        `motion:${String(motion.stateChange)}+${String(motion.reducedMotionBehavior)}`
    ].join(";");
    const regionEntries = records(profileView.regions).map((region) => {
        const groups = [];
        let actionRun = [];
        const flushActions = () => {
            if (actionRun.length === 0)
                return;
            groups.push(`          <WrapPanel Margin="0,0,0,${xml(spacing.sm)}" AutomationProperties.HelpText="adaptation:${xml(presentation.adaptation.actionFlow)}">\n${actionRun.map((item) => renderAvaloniaSemanticItem(item, interaction, presentation)).join("\n")}\n          </WrapPanel>`);
            actionRun = [];
        };
        for (const item of records(region.items)) {
            if (item.semanticKind === "action")
                actionRun.push(item);
            else {
                flushActions();
                groups.push(renderAvaloniaSemanticItem(item, interaction, presentation));
            }
        }
        flushActions();
        const items = groups.join("\n");
        const isRow = ["row", "primary-action-region"].includes(String(region.layoutIntent));
        const panel = isRow ? "WrapPanel" : "StackPanel";
        const role = String(region.role ?? "primary-content");
        const placement = profileView.layoutIntent === "workspace" ? {
            navigation: 'Grid.Column="0" Grid.Row="0" Grid.RowSpan="6" Margin="0,0,18,0"',
            hero: 'Grid.Column="1" Grid.Row="0" Grid.ColumnSpan="2" Margin="0,0,0,18"',
            context: 'Grid.Column="1" Grid.Row="1" Margin="0,0,18,18"',
            summary: 'Grid.Column="2" Grid.Row="1" Margin="0,0,0,18"',
            "primary-content": 'Grid.Column="1" Grid.Row="2" Grid.RowSpan="2" Margin="0,0,18,18"',
            document: 'Grid.Column="2" Grid.Row="2" Margin="0,0,0,18"',
            assurance: 'Grid.Column="2" Grid.Row="3" Margin="0,0,0,18"',
            proof: 'Grid.Column="1" Grid.Row="4" Grid.ColumnSpan="2" Margin="0,0,0,18"',
            actions: 'Grid.Column="1" Grid.Row="5" Grid.ColumnSpan="2" Margin="0"'
        }[role] ?? 'Grid.Column="1" Grid.Row="5" Grid.ColumnSpan="2" Margin="0,0,0,18"' : "";
        return {
            role,
            content: `      <Border Classes="sda-panel" ${placement} AutomationProperties.HelpText="role:${xml(role)};importance:${xml(region.importance ?? "secondary")}">\n        <StackPanel>\n          <TextBlock Text="${xml(region.title)}" Classes="sda-region-title" AutomationProperties.AutomationId="sda-region:${xml(region.regionId)}" AutomationProperties.Name="${xml(region.title)}" AutomationProperties.HelpText="hierarchy:${xml(presentation.intent.hierarchy && presentation.intent.hierarchy.regionTitle)};grouping:${xml(region.layoutIntent)};surface:${xml(presentation.intent.surfaces.region)};role:${xml(role)}" />\n          <${panel}>\n${items}\n          </${panel}>\n        </StackPanel>\n      </Border>`
        };
    });
    const sections = profileView.layoutIntent === "workspace"
        ? `      <Grid>\n        <Grid.ColumnDefinitions><ColumnDefinition Width="260" /><ColumnDefinition Width="1.05*" /><ColumnDefinition Width="0.95*" /></Grid.ColumnDefinitions>\n        <Grid.RowDefinitions><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /><RowDefinition Height="Auto" /></Grid.RowDefinitions>\n${regionEntries.map((entry) => entry.content).join("\n")}\n      </Grid>`
        : regionEntries.map((entry) => entry.content).join("\n");
    return `<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<Window x:Class="Sda.ProjectedConsumer.MainWindow"\n        xmlns="https://github.com/avaloniaui"\n        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n        xmlns:avalonia="clr-namespace:ScenarioKernel.Avalonia;assembly=ScenarioKernel.Avalonia"\n        xmlns:local="clr-namespace:Sda.ProjectedConsumer"\n        Title="${xml(view.title ?? authority.title)}" Width="${xml(view.width)}" Height="${xml(view.height)}" MinWidth="360" MinHeight="520"\n        Background="${xml(colors.pageSurface)}" Foreground="${xml(colors.textPrimary)}" FontFamily="Segoe UI" FontSize="${xml(size("body"))}"\n        WindowStartupLocation="CenterScreen" AutomationProperties.AutomationId="sda-view:${xml(profileView.viewId)}" AutomationProperties.HelpText="${windowIntent}">\n  <Window.Resources>\n    <SolidColorBrush x:Key="SdaContentSurfaceBrush" Color="${xml(colors.contentSurface)}" />\n    <SolidColorBrush x:Key="SdaSupportingSurfaceBrush" Color="${xml(colors.supportingSurface)}" />\n    <SolidColorBrush x:Key="SdaBorderBrush" Color="${xml(colors.border)}" />\n    <SolidColorBrush x:Key="SdaTextPrimaryBrush" Color="${xml(colors.textPrimary)}" />\n    <SolidColorBrush x:Key="SdaTextSupportingBrush" Color="${xml(colors.textSupporting)}" />\n    <SolidColorBrush x:Key="SdaPrimaryActionBrush" Color="${xml(colors.primaryAction)}" />\n    <SolidColorBrush x:Key="SdaPrimaryActionContentBrush" Color="${xml(colors.primaryActionContent)}" />\n    <SolidColorBrush x:Key="SdaSecondaryActionBrush" Color="${xml(colors.secondaryAction)}" />\n    <SolidColorBrush x:Key="SdaSecondaryActionContentBrush" Color="${xml(colors.secondaryActionContent)}" />\n    <SolidColorBrush x:Key="SdaDestructiveActionBrush" Color="${xml(colors.destructiveAction)}" />\n    <SolidColorBrush x:Key="SdaDestructiveActionContentBrush" Color="${xml(colors.destructiveActionContent)}" />\n    <SolidColorBrush x:Key="SdaStatusSurfaceBrush" Color="${xml(colors.statusSurface)}" />\n    <SolidColorBrush x:Key="SdaStatusAccentBrush" Color="${xml(colors.statusAccent)}" />\n    <SolidColorBrush x:Key="SdaErrorSurfaceBrush" Color="${xml(colors.errorSurface)}" />\n    <SolidColorBrush x:Key="SdaErrorAccentBrush" Color="${xml(colors.errorAccent)}" />\n    <SolidColorBrush x:Key="SdaFocusBrush" Color="${xml(colors.focus)}" />\n  </Window.Resources>\n  <Window.Styles>\n    <Style Selector="TextBlock.sda-page-title"><Setter Property="FontSize" Value="${xml(size("display"))}" /><Setter Property="FontWeight" Value="${weight("display")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.xs)}" /></Style>\n    <Style Selector="TextBlock.sda-region-title"><Setter Property="FontSize" Value="${xml(size("section"))}" /><Setter Property="FontWeight" Value="${weight("section")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.md)}" /></Style>\n    <Style Selector="TextBlock.sda-label"><Setter Property="FontSize" Value="${xml(size("label"))}" /><Setter Property="FontWeight" Value="${weight("label")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.xs)}" /></Style>\n    <Style Selector="TextBlock.sda-supporting-text"><Setter Property="FontSize" Value="${xml(size("supporting"))}" /><Setter Property="FontWeight" Value="${weight("supporting")}" /><Setter Property="Foreground" Value="{StaticResource SdaTextSupportingBrush}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.md)}" /></Style>\n    <Style Selector="TextBlock.sda-error-text"><Setter Property="Foreground" Value="{StaticResource SdaErrorAccentBrush}" /></Style>\n    <Style Selector="Border.sda-panel"><Setter Property="Background" Value="{StaticResource SdaContentSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaBorderBrush}" /><Setter Property="BorderThickness" Value="1" /><Setter Property="CornerRadius" Value="${xml(shape.panelRadius)}" /><Setter Property="Padding" Value="${xml(spacing.lg)}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.lg)}" /><Setter Property="BoxShadow" Value="0 2 16 0 #14000000" /></Style>\n    <Style Selector="TextBox"><Setter Property="Foreground" Value="{StaticResource SdaTextPrimaryBrush}" /><Setter Property="Background" Value="{StaticResource SdaContentSurfaceBrush}" /><Setter Property="BorderBrush" Value="#AEBBD0" /><Setter Property="BorderThickness" Value="1" /><Setter Property="Padding" Value="10,8" /><Setter Property="MinHeight" Value="38" /></Style>\n    <Style Selector="TextBox:focus"><Setter Property="BorderBrush" Value="{StaticResource SdaFocusBrush}" /><Setter Property="BorderThickness" Value="2" /></Style>\n    <Style Selector="TextBox.sda-readonly-surface"><Setter Property="Background" Value="{StaticResource SdaSupportingSurfaceBrush}" /></Style>\n    <Style Selector="Button.sda-action"><Setter Property="Padding" Value="14,9" /><Setter Property="Margin" Value="0,0,${xml(spacing.sm)},${xml(spacing.sm)}" /><Setter Property="MinHeight" Value="38" /><Setter Property="CornerRadius" Value="${xml(shape.controlRadius)}" /><Setter Property="HorizontalAlignment" Value="Left" /></Style>\n    <Style Selector="Button.sda-action:focus-visible"><Setter Property="BorderBrush" Value="{StaticResource SdaFocusBrush}" /><Setter Property="BorderThickness" Value="2" /></Style>\n    <Style Selector="Button.sda-action-primary"><Setter Property="Background" Value="{StaticResource SdaPrimaryActionBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaPrimaryActionContentBrush}" /></Style>\n    <Style Selector="Button.sda-action-secondary"><Setter Property="Background" Value="{StaticResource SdaSecondaryActionBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaSecondaryActionContentBrush}" /></Style>\n    <Style Selector="Button.sda-action-destructive"><Setter Property="Background" Value="{StaticResource SdaDestructiveActionBrush}" /><Setter Property="Foreground" Value="{StaticResource SdaDestructiveActionContentBrush}" /></Style>\n    <Style Selector="Border.sda-status-surface"><Setter Property="Background" Value="{StaticResource SdaStatusSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaStatusAccentBrush}" /><Setter Property="BorderThickness" Value="4,0,0,0" /><Setter Property="Padding" Value="${xml(spacing.md)},${xml(spacing.sm)}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.md)}" /></Style>\n    <Style Selector="Border.sda-error-surface"><Setter Property="Background" Value="{StaticResource SdaErrorSurfaceBrush}" /><Setter Property="BorderBrush" Value="{StaticResource SdaErrorAccentBrush}" /><Setter Property="BorderThickness" Value="1" /><Setter Property="CornerRadius" Value="${xml(shape.controlRadius)}" /><Setter Property="Padding" Value="${xml(spacing.md)}" /><Setter Property="Margin" Value="0,0,0,${xml(spacing.md)}" /></Style>\n  </Window.Styles>\n  <ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled" AutomationProperties.AutomationId="sda-presentation:application" AutomationProperties.HelpText="${windowIntent}">\n    <StackPanel Margin="${xml(spacing.xl)}" MaxWidth="1480" HorizontalAlignment="Stretch">\n      <TextBlock Text="${xml(authority.title)}" Classes="sda-page-title" AutomationProperties.AutomationId="sda-presentation:page-title" AutomationProperties.Name="${xml(authority.title)}" AutomationProperties.HelpText="hierarchy:${xml(presentation.intent.hierarchy.pageTitle)};typography:display" />\n      <TextBlock Text="${xml(authority.experienceAuthority.promise)}" Classes="sda-supporting-text" AutomationProperties.AutomationId="sda-presentation:experience-promise" AutomationProperties.Name="${xml(authority.experienceAuthority.promise)}" />\n${sections}\n    </StackPanel>\n  </ScrollViewer>\n  <Window.DataContext>\n    <local:ProjectedUiViewModel />\n  </Window.DataContext>\n</Window>\n`;
}
export function renderAvaloniaProject(avaloniaProjectRef) {
    return `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>WinExe</OutputType>\n    <TargetFramework>net10.0</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n    <AvaloniaUseCompiledBindingsByDefault>false</AvaloniaUseCompiledBindingsByDefault>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include="Avalonia.Desktop" Version="12.1.1" />\n    <PackageReference Include="Avalonia.Themes.Fluent" Version="12.1.1" />\n  </ItemGroup>\n  <ItemGroup>\n    <ProjectReference Include="${avaloniaProjectRef}" />\n  </ItemGroup>\n  <ItemGroup>\n    <Content Include="..\\..\\application-binding.csharp.json" Link="authority\\application-binding.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\..\\capability.json" Link="authority\\capability.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\..\\query\\conformance-query.csharp.json" Link="authority\\query\\conformance-query.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\..\\fixtures\\fixtures.json" Link="authority\\fixtures\\fixtures.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="ui\\ui-authority.csharp.json" Link="authority\\ui-authority.csharp.json" CopyToOutputDirectory="PreserveNewest" />\n    <Content Include="..\\..\\projection-conformance.json" Link="authority\\projection-conformance.json" CopyToOutputDirectory="PreserveNewest" Condition="Exists('..\\..\\projection-conformance.json')" />\n  </ItemGroup>\n</Project>\n`;
}
export function renderSdkClient() {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\n#nullable enable\nusing System.Text.Json.Nodes;\nusing ScenarioKernel.Adapters.Consumer;\n\nnamespace ScenarioKernel.ProjectedConsumer;\n\npublic sealed class ProjectedConsumerClient\n{\n    private readonly string _bindingPath;\n\n    public ProjectedConsumerClient(string bindingPath)\n    {\n        _bindingPath = bindingPath;\n    }\n\n    public static ProjectedConsumerClient CreateDefault() =>\n        new(Path.Combine(AppContext.BaseDirectory, "authority", "application-binding.csharp.json"));\n\n    public Task<AdmittedConsumerPlatform.ConsumerExecutionResult> ExecuteAsync(JsonNode input, CancellationToken cancellationToken = default) =>\n        AdmittedConsumerPlatform.ExecuteAsync(_bindingPath, input, cancellationToken);\n\n    public ValueTask<JsonNode?> QueryAsync(\n        JsonNode profile,\n        string queryId,\n        JsonObject? parameters = null,\n        CancellationToken cancellationToken = default) =>\n        AdmittedConsumerPlatform.QueryAsync(_bindingPath, profile, queryId, parameters, cancellationToken);\n}\n`;
}
export function renderDirectoryBuildProps(buildOutputRoot) {
    return `<Project>\n  <PropertyGroup>\n    <SdaConsumerProjectionBuildRoot Condition="'$(SdaConsumerProjectionBuildRoot)' == ''">$(MSBuildThisFileDirectory)${buildOutputRoot}</SdaConsumerProjectionBuildRoot>\n  </PropertyGroup>\n  <PropertyGroup Condition="$([System.String]::Copy('$(MSBuildProjectName)').StartsWith('ProjectedConsumerSdk.generated'))">\n    <BaseOutputPath>$(SdaConsumerProjectionBuildRoot)\\bin\\sdk\\</BaseOutputPath>\n    <BaseIntermediateOutputPath>$(SdaConsumerProjectionBuildRoot)\\obj\\sdk\\</BaseIntermediateOutputPath>\n    <MSBuildProjectExtensionsPath>$(SdaConsumerProjectionBuildRoot)\\obj\\sdk\\</MSBuildProjectExtensionsPath>\n  </PropertyGroup>\n  <PropertyGroup Condition="$([System.String]::Copy('$(MSBuildProjectName)').StartsWith('ProjectedConsumerCli.generated'))">\n    <BaseOutputPath>$(SdaConsumerProjectionBuildRoot)\\bin\\cli\\</BaseOutputPath>\n    <BaseIntermediateOutputPath>$(SdaConsumerProjectionBuildRoot)\\obj\\cli\\</BaseIntermediateOutputPath>\n    <MSBuildProjectExtensionsPath>$(SdaConsumerProjectionBuildRoot)\\obj\\cli\\</MSBuildProjectExtensionsPath>\n  </PropertyGroup>\n  <PropertyGroup Condition="$([System.String]::Copy('$(MSBuildProjectName)').StartsWith('ProjectedConsumerWpf.generated'))">\n    <BaseOutputPath>$(SdaConsumerProjectionBuildRoot)\\bin\\wpf\\</BaseOutputPath>\n    <BaseIntermediateOutputPath>$(SdaConsumerProjectionBuildRoot)\\obj\\wpf\\</BaseIntermediateOutputPath>\n    <MSBuildProjectExtensionsPath>$(SdaConsumerProjectionBuildRoot)\\obj\\wpf\\</MSBuildProjectExtensionsPath>\n  </PropertyGroup>\n  <PropertyGroup Condition="$([System.String]::Copy('$(MSBuildProjectName)').StartsWith('ProjectedConsumerAvalonia.generated'))">\n    <BaseOutputPath>$(SdaConsumerProjectionBuildRoot)\\bin\\avalonia\\</BaseOutputPath>\n    <BaseIntermediateOutputPath>$(SdaConsumerProjectionBuildRoot)\\obj\\avalonia\\</BaseIntermediateOutputPath>\n    <MSBuildProjectExtensionsPath>$(SdaConsumerProjectionBuildRoot)\\obj\\avalonia\\</MSBuildProjectExtensionsPath>\n  </PropertyGroup>\n</Project>\n`;
}
export function renderDirectoryBuildTargets() {
    return `<Project>\n  <ItemGroup Condition="Exists('$(MSBuildThisFileDirectory)..\\execution-plans')">\n    <Content Include="$(MSBuildThisFileDirectory)..\\execution-plans\\*.json" Link="authority\\execution-plans\\%(Filename)%(Extension)" CopyToOutputDirectory="PreserveNewest" />\n  </ItemGroup>\n</Project>\n`;
}
export class CsharpConsumerApplicationProvider {
    target = "csharp";
    render(input) {
        const directory = path.join(input.workspaceRoot, "projected", "csharp");
        const buildCacheKey = sha256(input.capabilityId).slice("sha256:".length, "sha256:".length + 16);
        const buildRoot = path.relative(directory, path.join(input.repositoryRoot, "artifacts", "cb", buildCacheKey)).replaceAll("/", "\\");
        const activeInterfaces = input.interfaceAuthority.interfaces.filter((binding) => !binding.projectionTargets || binding.projectionTargets.includes("csharp"));
        const hasCli = activeInterfaces.some((binding) => binding.kind === "cli");
        const hasSdk = activeInterfaces.some((binding) => binding.kind === "sdk");
        const ui = uiAuthority(input);
        const files = [
            entry("csharp/Directory.Build.props", renderDirectoryBuildProps(buildRoot)),
            entry("csharp/Directory.Build.targets", renderDirectoryBuildTargets())
        ];
        if (hasCli || hasSdk) {
            files.push(entry("csharp/ProjectedConsumerClient.generated.cs", renderSdkClient()), entry("csharp/ProjectedConsumerSdk.generated.csproj", renderSdkProject(resolveAdapterProjectRef(input.repositoryRoot, directory))));
        }
        if (hasCli) {
            files.push(entry("csharp/Program.generated.cs", renderProgram()), entry("csharp/ProjectedConsumerCli.generated.csproj", renderCliProject(resolveAdapterProjectRef(input.repositoryRoot, directory))));
        }
        if (ui) {
            const avaloniaDirectory = path.join(directory, "avalonia");
            const avaloniaRuntimeProjectRef = requiresAvaloniaCustomSurfaces(ui.authority)
                ? resolveAvaloniaProjectRef(input.repositoryRoot, avaloniaDirectory)
                : resolveUiAuthorityProjectRef(input.repositoryRoot, avaloniaDirectory);
            files.push(entry("csharp/App.generated.xaml", renderWpfApp(), [ui.authorityRef]), entry("csharp/MainWindow.generated.xaml", realizeScalarPresentationResources(renderWpfWindow(ui.authority), ui.authority), [ui.authorityRef]), entry("csharp/ProjectedUiViewModel.generated.cs", renderProjectedUiViewModel(), [ui.authorityRef]), entry("csharp/ProjectedConsumerWpf.generated.csproj", renderWpfProject(resolveWpfProjectRef(input.repositoryRoot, directory)), [ui.authorityRef]), entry("csharp/ui/ui-authority.csharp.json", `${JSON.stringify(ui.authority, null, 2)}\n`, [ui.authorityRef]), entry("csharp/avalonia/App.generated.axaml", renderAvaloniaApp(), [ui.authorityRef]), entry("csharp/avalonia/App.generated.axaml.cs", renderAvaloniaAppCodeBehind(), [ui.authorityRef]), entry("csharp/avalonia/AvaloniaProgram.generated.cs", renderAvaloniaProgram(), [ui.authorityRef]), entry("csharp/avalonia/MainWindow.generated.axaml", renderAvaloniaWindow(ui.authority), [ui.authorityRef]), entry("csharp/avalonia/MainWindow.generated.axaml.cs", renderAvaloniaWindowCodeBehind(), [ui.authorityRef]), entry("csharp/avalonia/ProjectedUiViewModel.generated.cs", renderProjectedUiViewModel(), [ui.authorityRef]), entry("csharp/avalonia/ProjectedConsumerAvalonia.generated.csproj", renderAvaloniaProject(avaloniaRuntimeProjectRef), [ui.authorityRef]), entry("csharp/avalonia/ui/ui-authority.csharp.json", `${JSON.stringify(ui.authority, null, 2)}\n`, [ui.authorityRef]));
        }
        return Object.freeze(files);
    }
}
