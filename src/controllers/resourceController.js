import Resource from '../models/Resource.js';

// Get all resources for organizer
export const getResources = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = { organizer: req.user._id };

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const resources = await Resource.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: resources.length,
      data: resources,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resources',
      error: error.message,
    });
  }
};

// Get single resource
export const getResource = async (req, res) => {
  try {
    const resource = await Resource.findOne({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource',
      error: error.message,
    });
  }
};

// Create resource
export const createResource = async (req, res) => {
  try {
    const resourceData = {
      ...req.body,
      organizer: req.user._id,
    };

    const resource = await Resource.create(resourceData);

    res.status(201).json({
      success: true,
      message: 'Resource created successfully',
      data: resource,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create resource',
      error: error.message,
    });
  }
};

// Update resource
export const updateResource = async (req, res) => {
  try {
    const resource = await Resource.findOneAndUpdate(
      {
        _id: req.params.id,
        organizer: req.user._id,
      },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    res.json({
      success: true,
      message: 'Resource updated successfully',
      data: resource,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update resource',
      error: error.message,
    });
  }
};

// Delete resource
export const deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findOneAndDelete({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    res.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource',
      error: error.message,
    });
  }
};

// Toggle resource active status
export const toggleResourceStatus = async (req, res) => {
  try {
    const resource = await Resource.findOne({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    resource.isActive = !resource.isActive;
    await resource.save();

    res.json({
      success: true,
      message: `Resource ${resource.isActive ? 'activated' : 'deactivated'} successfully`,
      data: resource,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle resource status',
      error: error.message,
    });
  }
};

// Get resource statistics
export const getResourceStats = async (req, res) => {
  try {
    const stats = await Resource.aggregate([
      { $match: { organizer: req.user._id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] },
          },
          totalBookings: { $sum: '$totalBookings' },
        },
      },
    ]);

    const totalResources = await Resource.countDocuments({
      organizer: req.user._id,
    });

    const activeResources = await Resource.countDocuments({
      organizer: req.user._id,
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        total: totalResources,
        active: activeResources,
        byType: stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource statistics',
      error: error.message,
    });
  }
};
