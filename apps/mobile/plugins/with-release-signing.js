const { withAppBuildGradle } = require("@expo/config-plugins");

const marker = "// AlphaFinance official release signing";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error(
        "A assinatura do AlphaFinance requer o build.gradle Android em Groovy.",
      );
    }

    let contents = gradleConfig.modResults.contents;
    if (contents.includes(marker)) return gradleConfig;

    const androidBlock = "android {";
    const androidIndex = contents.indexOf(androidBlock);
    if (androidIndex < 0)
      throw new Error(
        "Não foi possível localizar a configuração Android para aplicar a assinatura.",
      );

    const signingSetup = `${marker}
def alphaFinanceSigningPropertiesPath = System.getenv("ALPHAFINANCE_SIGNING_PROPERTIES")
def alphaFinanceSigningPropertiesFile = alphaFinanceSigningPropertiesPath
    ? new File(alphaFinanceSigningPropertiesPath)
    : new File(rootDir, "../../../../AlphaFinance-signing/signing.properties").canonicalFile
def alphaFinanceSigningProperties = new Properties()
if (alphaFinanceSigningPropertiesFile.exists()) {
    alphaFinanceSigningPropertiesFile.withInputStream { alphaFinanceSigningProperties.load(it) }
}

`;
    contents =
      contents.slice(0, androidIndex) +
      signingSetup +
      contents.slice(androidIndex);

    const signingBoundary = "        }\n    }\n    buildTypes {";
    const signingBoundaryIndex = contents.indexOf(
      signingBoundary,
      contents.indexOf("signingConfigs {"),
    );
    if (signingBoundaryIndex < 0)
      throw new Error(
        "Não foi possível adicionar a chave release do AlphaFinance.",
      );

    const releaseSigningConfig = `        }
        release {
            storeFile alphaFinanceSigningProperties["storeFile"] ? file(alphaFinanceSigningProperties["storeFile"]) : null
            storePassword alphaFinanceSigningProperties["storePassword"]
            keyAlias alphaFinanceSigningProperties["keyAlias"]
            keyPassword alphaFinanceSigningProperties["keyPassword"]
        }
    }
    buildTypes {`;
    contents =
      contents.slice(0, signingBoundaryIndex) +
      releaseSigningConfig +
      contents.slice(signingBoundaryIndex + signingBoundary.length);

    const lastDebugSigning = contents.lastIndexOf(
      "signingConfig signingConfigs.debug",
    );
    if (lastDebugSigning < 0)
      throw new Error(
        "Não foi possível configurar a assinatura do build release.",
      );
    contents =
      contents.slice(0, lastDebugSigning) +
      "signingConfig signingConfigs.release" +
      contents.slice(
        lastDebugSigning + "signingConfig signingConfigs.debug".length,
      );

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
};
