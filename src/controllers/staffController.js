import Staff from '../models/Staff.js';

// Get all staff for organizer
export const getStaff = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = { organizer: req.user._id };

    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const staff = await Staff.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: staff.length,
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff',
      error: error.message,
    });
  }
};

// Get single staff member
export const getStaffMember = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff member',
      error: error.message,
    });
  }
};

// Create staff member
export const createStaffMember = async (req, res) => {
  try {
    const staffData = {
      ...req.body,
      organizer: req.user._id,
    };

    const staff = await Staff.create(staffData);

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: staff,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Staff member with this email already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create staff member',
      error: error.message,
    });
  }
};

// Update staff member
export const updateStaffMember = async (req, res) => {
  try {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message,
    });
  }
};

// Delete staff member
export const deleteStaffMember = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    res.json({
      success: true,
      message: 'Staff member deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member',
      error: error.message,
    });
  }
};

// Toggle staff member active status
export const toggleStaffStatus = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    res.json({
      success: true,
      message: `Staff member ${staff.isActive ? 'activated' : 'deactivated'} successfully`,
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle staff status',
      error: error.message,
    });
  }
};
