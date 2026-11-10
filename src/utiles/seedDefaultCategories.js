const Category = require('../Models/categoryModel');

const defaultCategories = [
  { name: 'Home Cleaning', slug: 'home-cleaning', sortOrder: 10 },
  { name: 'Beauty & Grooming', slug: 'beauty-grooming', sortOrder: 20 },
  { name: 'Repairs & Handyman', slug: 'repairs-handyman', sortOrder: 30 },
  { name: 'Moving & Delivery', slug: 'moving-delivery', sortOrder: 40 },
  { name: 'Education & Tutoring', slug: 'education-tutoring', sortOrder: 50 },
  { name: 'Personal Care', slug: 'personal-care', sortOrder: 60 }
];

module.exports = async function seedDefaultCategories() {
  if (await Category.exists({})) return;

  await Category.bulkWrite(defaultCategories.map(category => ({
    updateOne: {
      filter: { slug: category.slug },
      update: { $setOnInsert: category },
      upsert: true
    }
  })));
};
