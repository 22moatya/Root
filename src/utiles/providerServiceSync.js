const Category = require('../Models/categoryModel');
const ProviderProfile = require('../Models/providerModel');
const Service = require('../Models/serviceModel');
const User = require('../Models/userModel');

const ensureCategoryServices = async (categoryId, session) => {
  const query = Service.find({ category: categoryId }).select('_id');
  if (session) query.session(session);
  const existingServices = await query;
  if (existingServices.length) return existingServices;

  const categoryQuery = Category.findById(categoryId).select('name');
  if (session) categoryQuery.session(session);
  const category = await categoryQuery;
  if (!category) throw new Error('Provider work category no longer exists');

  try {
    const listing = await Service.findOneAndUpdate(
      { category: categoryId, isCategoryListing: true },
      {
        $setOnInsert: {
          name: category.name,
          description: `Book a ${category.name.toLowerCase()} professional. Confirm the price directly with your provider.`,
          category: categoryId,
          isCategoryListing: true
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    return [listing];
  } catch (error) {
    if (error.code !== 11000) throw error;
    if (session) throw error;
    const listing = await Service.findOne({ category: categoryId, isCategoryListing: true });
    if (!listing) throw error;
    return [listing];
  }
};

exports.ensureCategoryServices = ensureCategoryServices;

exports.syncApprovedProviderServices = async () => {
  const profiles = await ProviderProfile.find({
    workCategory: { $ne: null }
  }).populate({
    path: 'user',
    match: { role: 'provider', isActive: { $ne: false } },
    select: '_id'
  }).select('user workCategory');

  const activeProfiles = profiles.filter(profile => profile.user);
  const categoryIds = [...new Set(activeProfiles.map(profile => String(profile.workCategory)))];

  for (const categoryId of categoryIds) {
    const services = await ensureCategoryServices(categoryId);
    const userIds = activeProfiles
      .filter(profile => String(profile.workCategory) === categoryId)
      .map(profile => profile.user._id);
    await ProviderProfile.updateMany(
      { user: { $in: userIds }, workCategory: categoryId },
      { $addToSet: { services: { $each: services.map(service => service._id) } } }
    );
  }
};
