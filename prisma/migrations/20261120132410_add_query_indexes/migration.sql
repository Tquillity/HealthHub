-- CreateIndex
CREATE INDEX "ingredient_recipeId_idx" ON "ingredient"("recipeId");

-- CreateIndex
CREATE INDEX "instruction_recipeId_idx" ON "instruction"("recipeId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "meal_plan_organizationId_startDate_idx" ON "meal_plan"("organizationId", "startDate");

-- CreateIndex
CREATE INDEX "meal_plan_item_mealPlanId_date_idx" ON "meal_plan_item"("mealPlanId", "date");

-- CreateIndex
CREATE INDEX "meal_plan_template_organizationId_idx" ON "meal_plan_template"("organizationId");

-- CreateIndex
CREATE INDEX "meal_plan_template_item_templateId_idx" ON "meal_plan_template_item"("templateId");

-- CreateIndex
CREATE INDEX "phase_recommendation_phase_category_idx" ON "phase_recommendation"("phase", "category");

-- CreateIndex
CREATE INDEX "recipe_organizationId_idx" ON "recipe"("organizationId");

-- CreateIndex
CREATE INDEX "routine_organizationId_idx" ON "routine"("organizationId");

-- CreateIndex
CREATE INDEX "shopping_list_item_organizationId_idx" ON "shopping_list_item"("organizationId");
