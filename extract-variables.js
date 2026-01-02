// Скрипт для извлечения переменных из HTML формы
// Вставьте этот код в консоль браузера (F12)

(function() {
  // Находим все элементы с data-variable-group
  const variableRows = document.querySelectorAll('[data-variable-group]');
  
  const variables = [];
  
  variableRows.forEach((row) => {
    const groupIndex = row.getAttribute('data-variable-group');
    
    // Находим input с ключом
    const keyInput = row.querySelector(`input[name="variables.${groupIndex}.key"]`);
    // Находим textarea со значением
    const valueTextarea = row.querySelector(`textarea[name="variables.${groupIndex}.value"]`);
    
    if (keyInput && valueTextarea) {
      const key = keyInput.value.trim();
      const value = valueTextarea.value.trim();
      
      if (key) {
        variables.push(`"${key}"=${value}`);
      }
    }
  });
  
  // Формируем итоговую строку
  const result = variables.join('\n');
  
  // Выводим результат
  console.log('Результат:');
  console.log(result);
  
  // Копируем в буфер обмена (если поддерживается)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(result).then(() => {
      console.log('\n✅ Результат скопирован в буфер обмена!');
    }).catch(err => {
      console.log('\n⚠️ Не удалось скопировать в буфер обмена, но результат выведен выше');
    });
  }
  
  return result;
})();

