import User from '../models/User.js';

// Get all team users for organizer
export const getTeamUsers = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = { 
      role: 'organizer',  // Team members are also organizers but belong to main organizer
      _id: { $ne: req.user._id } // Exclude the main organizer
    };

    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team users',
      error: error.message,
    });
  }
};

// Get single team user
export const getTeamUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message,
    });
  }
};

// Create team user
export const createTeamUser = async (req, res) => {
  try {
    const userData = {
      ...req.body,
      role: 'organizer', // Team members have organizer role but limited permissions
      emailVerified: true, // Auto-verify team members
    };

    // Check if email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use',
      });
    }

    const user = await User.create(userData);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Team user created successfully',
      data: userResponse,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create team user',
      error: error.message,
    });
  }
};

// Update team user
export const updateTeamUser = async (req, res) => {
  try {
    // Don't allow password update through this endpoint
    const { password, role, ...updateData } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Team user updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update team user',
      error: error.message,
    });
  }
};

// Delete team user
export const deleteTeamUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Team user deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete team user',
      error: error.message,
    });
  }
};

// Toggle user active status
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status',
      error: error.message,
    });
  }
};
