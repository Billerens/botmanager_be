const fs = require('fs');
const path = "g:\\Projects\\botmanager_be\\backend\\src\\modules\\bots\\nodes\\form-node.handler.ts";
let content = fs.readFileSync(path, 'utf8');

// Fix in showCurrentField
content = content.replace(
  /if \(!currentField\) \{\s*this\.logger\.warn\(`Поле с индексом \$\{currentFieldIndex\} не найдено`\);\s*return;\s*\}/,
  `if (!currentField) {
      this.logger.warn(
        \`Поле с индексом \${currentFieldIndex} не найдено. Пытаемся завершить или перейти.\`
      );
      if (currentFieldIndex >= formFields.length) {
        await this.showFormCompletion(context);
      } else {
        await this.moveToNextNode(context, currentNode.nodeId);
      }
      return;
    }`
);

// Fix in handleFieldInput
content = content.replace(
  /if \(!currentField\) \{\s*this\.logger\.warn\(`Поле с индексом \$\{currentFieldIndex\} не найдено`\);\s*return;\s*\}/,
  `if (!currentField) {
      this.logger.warn(
        \`Поле с индексом \${currentFieldIndex} не найдено при обработке ввода. Переходим к завершению.\`
      );
      await this.showFormCompletion(context);
      return;
    }`
);

fs.writeFileSync(path, content);
console.log("Successfully patched form-node.handler.ts");
