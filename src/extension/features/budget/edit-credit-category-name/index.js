import { Feature } from 'toolkit/extension/features/feature';
import { serviceLookup } from 'toolkit/extension/utils/ember';

export class EditCreditCategoryName extends Feature {
  shouldInvoke() {
    return true;
  }

  invoke() {
    const budgetService = serviceLookup('budget');
    const originalEditCategory = budgetService.editCategory.bind(budgetService);
    budgetService.editCategory = function (category, triggerElement) {
      if (category.isMasterCategory && category.isCreditCardPaymentCategory) {
        category.canRename = true;
      }
      originalEditCategory(category, triggerElement);
    };
  }
}
