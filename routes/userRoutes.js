const express = require('express');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const jwt = require("jsonwebtoken");
const User = require('../models/User'); // Adjust the path as per your project structure
const sendEmail = require('../utils/email'); // Adjust the path as needed
const { check, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const crypto = require('crypto');
const upload = require('../config/multerConfig')
const router = express.Router();

// Function to generate a unique account number
const generateAccountNumber = async () => {
  let accountNumber, userExists;
  do {
    accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    userExists = await User.findOne({ 'accounts.accountNumber': accountNumber });
  } while (userExists);
  return accountNumber;
};

// Route for user registration
router.post(
  '/register',
  [
    // Validation rules
    check('firstName').notEmpty().withMessage('First name is required'),
    check('lastName').notEmpty().withMessage('Last name is required'),
    check('email').isEmail().withMessage('Please provide a valid email'),
    check('phoneNumber').notEmpty().withMessage('Phone number is required'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    check('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
    check('dateOfBirth').isDate().withMessage('Please provide a valid date of birth'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      firstName,
      middleName,
      lastName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      accountType,
      address,
      postalCode,
      state,
      country,
      currency,
      password,
      accountPin,
    } = req.body;

    try {
      // Check if the user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Generate OTP
      const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false, alphabets: false });
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

      // Hash password and account pin
      const hashedPassword = await bcrypt.hash(password, 10);
      const hashedAccountPin = await bcrypt.hash(accountPin, 10);

      // Generate unique account number
      const accountNumber = await generateAccountNumber();

      // Create account object
      const account = {
        accountId: new mongoose.Types.ObjectId(),
        accountNumber,
        type: accountType,
        balance: 0,
        currency,
        transactions: [],
      };

      // Create a new user instance
      const user = new User({
        firstName,
        middleName,
        lastName,
        email,
        phoneNumber,
        gender,
        dateOfBirth,
        accountType,
        address,
        postalCode,
        state,
        country,
        currency,
        password: hashedPassword,
        accountPin: hashedAccountPin,
        agree: true,
        kycStatus: 'pending',
        otp,
        otpExpires,
        accounts: [account], // Add the account object to the user
        withdrawals: [], // Initialize withdrawals as empty
        loans: [], // Initialize loans as empty
        loanRepayments: [], // Initialize loan repayments as empty
      });

      // Save the user to the database
      await user.save();

      // Email content
      const emailSubject = 'OTP for Account Registration';
      const emailText = `Dear ${firstName},

We are delighted to assist you in completing your account registration with Central City Bank.

Please find below your One-Time Password (OTP) required for account registration:
OTP: ${otp}
This OTP is valid for a limited time. Please use it promptly to finalize your registration process.

If you encounter any difficulties or have any questions, please don't hesitate to contact our dedicated support team at centralcitybank0@gmail.com.

Thank you for choosing Central City Bank for your banking needs.

The Central City Bank Team`;

      const emailHtml = `<p>Dear ${firstName},</p>
<p>We are delighted to assist you in completing your account registration with Central City Bank.</p>
<p>Please find below your One-Time Password (OTP) required for account registration:</p>
<p><strong>OTP: ${otp}</strong></p>
<p>This OTP is valid for a limited time. Please use it promptly to finalize your registration process.</p>
<p>If you encounter any difficulties or have any questions, please don't hesitate to contact our dedicated support team at <a href="mailto:centralcitybank0@gmail.com">centralcitybank0@gmail.com</a>.</p>
<p>Thank you for choosing Central City Bank for your banking needs.</p>
<p>The Central City Bank Team</p>`;

      // Send email with OTP
      await sendEmail(email, emailSubject, emailText, emailHtml);

      // Respond with success message and user details
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          firstName,
          middleName,
          lastName,
          email,
          phoneNumber,
          gender,
          dateOfBirth,
          accountType,
          address,
          postalCode,
          state,
          country,
          currency,
          otp,
          kycStatus: 'pending',
          accounts: user.accounts,
          withdrawals: user.withdrawals,
          loans: user.loans,
          loanRepayments: user.loanRepayments,
        },
      });
    } catch (error) {
      console.error('Error during registration:', error.message);
      res.status(500).json({ message: 'Server error. Please try again later.' });
    }
  }
);

router.get("/", (req, res) => {
  res.send("hello world");
});


router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Validate input
    if (!email || !otp) {
      console.log("Missing fields:", { email, otp });
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if OTP has expired
    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Generate account number
    const accountNumber = await generateAccountNumber();

    // Define the new account object
    const newAccount = {
      accountId: new mongoose.Types.ObjectId(),
      accountNumber: accountNumber,
      type: "default", // Default type if not provided yet
      balance: 0,
      currency: "USD", // Default currency if not provided yet
      transactions: [],
    };

    // Add the new account to the user's accounts array
    user.accounts.push(newAccount);

    // Save the updated user document
    await user.save();

    // Compose email
    const emailSubject = "Your New Account Information";
    const emailHtml = `
      <p>Dear ${user.firstName} ${user.lastName},</p>
      <p>We are thrilled to inform you that your account has been successfully created with our platform. Your account details are provided below:</p>
      <p><strong>Account Number:</strong> ${accountNumber}</p>
      <p>Please keep this information secure and do not share it with anyone. If you have any questions or need assistance, feel free to contact our support team at <a href="mailto:centralcitybank0@gmail.com">centralcitybank0@gmail.com</a>.</p>
      <p>Thank you for choosing our platform.</p>
      <p>Best regards,<br/>Central City Bank</p>
      <p>USA<br/>
      centralcitybank0@gmail.com<br/>
      +12074021612</p>
    `;

    // Send account number to the user's email
    sendEmail(email, emailSubject, "", emailHtml);

    // Return success message along with full user details
    res.status(201).json({
      message: "OTP verified, account number sent to your email successfully",
      user: {
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        accountType: user.accountType,
        address: user.address,
        postalCode: user.postalCode,
        state: user.state,
        country: user.country,
        currency: user.currency,
        accounts: user.accounts,
        withdrawals: user.withdrawals,
        loans: user.loans,
        loanRepayments: user.loanRepayments,
        dateOfAccountCreation: user.dateOfAccountCreation,
        kycStatus: user.kycStatus,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/login", async (req, res) => {
  const { accountNumber, password } = req.body;

  try {
    // Find the user by account number within their accounts array
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });

    if (!user) {
      console.log("User not found with account number:", accountNumber);
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid account number or password",
        });
    }

    console.log("User found:", user);
    console.log("Password provided:", password);
    console.log("Stored hashed password:", user.password);

    // Check if the provided password matches the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", user._id);
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid account number or password",
        });
    }

    // Extract the account number from the accounts array
    const account = user.accounts.find(
      (acc) => acc.accountNumber === accountNumber
    );

    // Generate a JWT token for the user
    const token = jwt.sign(
      { userId: user._id, accountNumber: accountNumber },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Send back a successful response with the token and essential user details
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        accounts: user.accounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          type: acc.type,
          balance: acc.balance,
          currency: acc.currency,
        })), // Returning only necessary account details
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error. Please try again later.",
      });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude password from the response
    res.status(200).json({
      message: "Users retrieved successfully",
      users,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving users", error: error.message });
  }
});

router.post(
  '/withdraw',
  [
    // Validation checks
    check('accountNumber').notEmpty().withMessage('Account number is required'),
    check('amount').isNumeric().withMessage('Amount should be a number'),
    check('currency').notEmpty().withMessage('Currency is required'),
    check('description').notEmpty().withMessage('Description is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountNumber, amount, currency, description } = req.body;

    try {
      // Find the user by account number
      const user = await User.findOne({ 'accounts.accountNumber': accountNumber });

      if (!user) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Find the specific account by accountNumber
      const account = user.accounts.find(acc => acc.accountNumber === accountNumber);

      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Check if the account has enough balance
      if (account.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      // Deduct the amount from the account balance
      account.balance -= amount;

      // Create a new withdrawal record with stages
      const newWithdrawal = {
        accountId: account.accountId,
        accountNumber,
        amount,
        currency,
        description,
        stages: [
          { name: 'stage1', completed: true },
          { name: 'stage2', completed: false },
          { name: 'stage3', completed: false },
          { name: 'stage4', completed: false },
          { name: 'stage5', completed: false }
        ],
        currentStage: 'stage1',
      };

      // Push the new withdrawal record into the user's withdrawals array
      user.withdrawals.push(newWithdrawal);

      // Save the updated user object
      await user.save();

      return res.status(201).json({
        message: 'Withdrawal initiated successfully',
        withdrawal: newWithdrawal,
        accountBalance: account.balance,
      });
    } catch (error) {
      console.error('Error processing withdrawal:', error.message);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

router.put(
  '/withdraw/update-stage/:withdrawalId',
  async (req, res) => {
    const { withdrawalId } = req.params;

    try {
      // Find the user and withdrawal by withdrawalId
      const user = await User.findOne({ 'withdrawals.withdrawalId': withdrawalId });
      if (!user) {
        return res.status(404).json({ message: 'Withdrawal not found' });
      }

      // Find the specific withdrawal by withdrawalId
      const withdrawal = user.withdrawals.find(w => w.withdrawalId.equals(withdrawalId));

      if (!withdrawal) {
        return res.status(404).json({ message: 'Withdrawal not found' });
      }

      // Find the current stage
      const currentStageIndex = withdrawal.stages.findIndex(stage => stage.name === withdrawal.currentStage);

      // If the current stage is already completed, don't move to the next
      if (withdrawal.stages[currentStageIndex].completed) {
        return res.status(400).json({ message: 'Current stage is already completed' });
      }

      // Mark the current stage as completed
      withdrawal.stages[currentStageIndex].completed = true;

      // Check if there is a next stage to move to
      if (currentStageIndex < withdrawal.stages.length - 1) {
        withdrawal.currentStage = withdrawal.stages[currentStageIndex + 1].name;
      } else {
        withdrawal.status = 'completed'; // All stages completed
      }

      // Save the user with the updated withdrawal
      await user.save();

      return res.status(200).json({
        message: 'Stage updated successfully',
        withdrawal,
      });
    } catch (error) {
      console.error('Error updating stage:', error.message);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post(
  '/deposit',
  [
    check('accountNumber').notEmpty().withMessage('Account number is required'),
    check('accountPin').notEmpty().withMessage('Account PIN is required'),
    check('amount').isNumeric().withMessage('Amount should be a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountNumber, accountPin, amount } = req.body;

    try {
      // Find user by account number
      const user = await User.findOne({ 'accounts.accountNumber': accountNumber });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify account pin
      const isMatch = await bcrypt.compare(accountPin, user.accountPin);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid account PIN' });
      }

      // Find the account by account number
      const account = user.accounts.find(acc => acc.accountNumber === accountNumber);
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Deposit funds into the account
      account.balance += amount;

      // Add transaction record
      account.transactions.push({
        transactionId: new mongoose.Types.ObjectId(),
        date: new Date(),
        type: 'deposit',
        amount,
        currency: account.currency,
        description: 'Deposit',
      });

      // Save the user document
      await user.save();

      res.status(200).json({ message: 'Deposit successful', account });
    } catch (error) {
      console.error('Error during deposit:', error);
      res.status(500).json({ message: 'Server error. Please try again later.' });
    }
  }
);

router.post("/update-transaction", async (req, res) => {
  const { userId, accountId, transaction } = req.body;

  try {
    console.log(
      "Received request to update transaction for userId:",
      userId,
      "and accountId:",
      accountId
    );

    // Find user by userId
    const user = await User.findById(userId);
    console.log("Found user:", user);

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    // Find the account in user's accounts array
    const account = user.accounts.find(
      (acc) => acc.accountId.toString() === accountId
    );
    console.log("Found account:", account);

    if (!account) {
      console.log("Account not found");
      return res.status(404).json({ message: "Account not found" });
    }

    // Validate and structure the transaction
    const validTransaction = {
      transactionId: transaction.transactionId,
      date: new Date(transaction.date),
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
    };

    // Ensure transactionId is valid
    if (!validTransaction.transactionId || !mongoose.Types.ObjectId.isValid(validTransaction.transactionId)) {
      console.log("Invalid transaction ID");
      return res.status(400).json({ message: "Invalid transaction ID" });
    }

    // Update account transactions
    account.transactions.push(validTransaction);

    // Save the updated user document
    await user.save();

    console.log("Transaction updated successfully");

    // Send a successful response with updated data
    res.status(200).json({
      message: "Transaction updated successfully",
      user: {
        _id: user._id,
        firstName: user.firstName,
        account: {
          _id: account.accountId,
          transactions: account.transactions,
        },
      },
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.get("/recent-transaction/:userId", async (req, res) => {
  const { userId } = req.params; // userId is provided in the URL parameters

  try {
    // Find user by userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get the most recent transactions
    const recentTransactions = user.accounts
      .reduce((acc, curr) => {
        return acc.concat(curr.transactions);
      }, [])
      .sort((a, b) => b.date - a.date)
      .slice(0, 10); // Get the top 10 recent transactions

    res.status(200).json({ recentTransactions });
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/update-balance", async (req, res) => {
  const { accountNumber, amountToAdd } = req.body;

  // Validate input
  if (!accountNumber || typeof amountToAdd !== "number") {
    return res.status(400).json({ message: "Account number and amount to add are required" });
  }

  try {
    // Find user by accountNumber
    const user = await User.findOne({ "accounts.accountNumber": accountNumber });

    if (!user) {
      return res.status(404).json({ message: "User with given account number not found" });
    }

    // Find the account in user's accounts array
    const accountIndex = user.accounts.findIndex(acc => acc.accountNumber === accountNumber);
    if (accountIndex === -1) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Update the balance
    user.accounts[accountIndex].balance += amountToAdd;

    // Update the user's primary balance as the sum of all account balances
    user.balance = user.accounts.reduce((acc, account) => acc + account.balance, 0);

    // Save the updated user document
    await user.save();

    res.status(200).json({
      message: "Account balance updated successfully",
      account: user.accounts[accountIndex],
      totalBalance: user.balance,
    });
  } catch (error) {
    console.error("Error updating balance:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/send-notification", async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !subject || !message) {
    return res
      .status(400)
      .json({ message: "Email, subject, and message are required" });
  }

  try {
    await sendEmail(email, subject, message);
    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    console.error("Error sending notification:", error);
    res
      .status(500)
      .json({ message: "Error sending notification. Please try again later." });
  }
});

router.get("/balance/:accountNumber", async (req, res) => {
  const { accountNumber } = req.params;

  try {
    // Find user by accountNumber
    const user = await User.findOne({ "accounts.accountNumber": accountNumber });

    if (!user) {
      return res.status(404).json({ message: "User with given account number not found" });
    }

    // Find the account in the user's accounts array
    const account = user.accounts.find(acc => acc.accountNumber === accountNumber);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Return the balance of the found account
    res.status(200).json({ balance: account.balance });
  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user if they exist
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    // Invalidate token logic (optional if using a token blacklist)
    // Example: Add token to a blacklist
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ message: "Error during logout" });
  }
});

// Get notifications for a user
router.get("/users/:userId/notifications", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch the user by userId
    const user = await User.findById(userId).select('notifications');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the notifications
    res.json({ notifications: user.notifications });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.post("/send-notifications", async (req, res) => {
  const { userId, message } = req.body;

  // Validate that userId and message are provided
  if (!userId || !message) {
    return res
      .status(400)
      .json({ message: "UserId and message are required" });
  }

  try {
    // Find the user by their userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create a new notification object
    const newNotification = {
      notificationId: new mongoose.Types.ObjectId(),
      message: message,
      date: Date.now(),
      read: false,  // Optional: can be included in req.body if needed
    };

    // Push the notification to the user's notifications array
    user.notifications.push(newNotification);

    // Save the updated user document
    await user.save();

    // Return success response
    res.status(200).json({ message: "Notification added successfully", notification: newNotification });
  } catch (error) {
    console.error("Error adding notification:", error);
    res
      .status(500)
      .json({ message: "Error adding notification. Please try again later." });
  }
});

router.post("/generate-statement", async (req, res) => {
  const { userId, accountNumber, startDate, endDate } = req.body;

  // Validate required fields
  if (!userId || !accountNumber || !startDate || !endDate) {
    return res.status(400).json({ message: "userId, accountNumber, startDate, and endDate are required" });
  }

  try {
    // Find the user by their userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the account based on the account number provided
    const account = user.accounts.find(acc => acc.accountNumber === accountNumber);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Filter transactions based on the date range provided
    const start = new Date(startDate);
    const end = new Date(endDate);
    const transactions = account.transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= start && transactionDate <= end;
    });

    // Generate the statement details
    const statement = {
      accountNumber: account.accountNumber,
      accountType: account.type,
      balance: account.balance,
      currency: account.currency,
      transactions: transactions,
      period: { startDate, endDate }
    };

    // Return the statement as a response
    res.status(200).json({ message: "Statement generated successfully", statement });
  } catch (error) {
    console.error("Error generating statement:", error);
    res.status(500).json({ message: "Error generating statement. Please try again later." });
  }
});

// POST /loans/create - Create a new loan for a user
router.post("/loans/create", async (req, res) => {
  const { userId, loanAmount, currency, interestRate, termLength } = req.body;

  if (!userId || !loanAmount || !currency || !interestRate || !termLength) {
    return res.status(400).json({ message: "All loan details are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const loan = {
      loanAmount,
      currency,
      interestRate,
      termLength,
      accountId: user._id,  // Link the loan to the user's account
    };

    user.loans.push(loan);
    await user.save();

    res.status(201).json({ message: "Loan created successfully", loan });
  } catch (error) {
    res.status(500).json({ message: "Error creating loan", error });
  }
});

// GET /loans/:loanId - Get details of a specific loan
router.get("/loans/:loanId", async (req, res) => {
  const { loanId } = req.params;

  try {
    const user = await User.findOne({ "loans.loanId": loanId }, { "loans.$": 1 });
    if (!user || !user.loans.length) {
      return res.status(404).json({ message: "Loan not found" });
    }

    res.status(200).json({ loan: user.loans[0] });
  } catch (error) {
    res.status(500).json({ message: "Error fetching loan details", error });
  }
});

router.post("/loans/repay", async (req, res) => {
  const { userId, loanId, repaymentAmount, currency } = req.body;

  // Validate request body
  if (!userId || !loanId || !repaymentAmount || !currency) {
    return res.status(400).json({ message: "All repayment details are required" });
  }

  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Convert loanId to ObjectId correctly
    const loanObjectId = new mongoose.Types.ObjectId(loanId);

    // Find the loan within the user's loans array
    const loan = user.loans.find(loan => loan._id.equals(loanObjectId));
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    // Check if the repaymentAmount is valid
    if (repaymentAmount <= 0) {
      return res.status(400).json({ message: "Invalid repayment amount" });
    }

    // Create a repayment entry
    const repayment = {
      repaymentId: new mongoose.Types.ObjectId(),
      loanId: loan._id,
      accountId: user._id,
      repaymentAmount,
      currency,
      date: Date.now(),
      status: "pending", // You can adjust this according to your logic
    };

    // Add repayment to the user's loanRepayments array
    user.loanRepayments.push(repayment);

    // Optionally update loan status or other fields if needed
    loan.status = "active"; // Update as per your logic

    // Save the updated user document
    await user.save();

    res.status(201).json({ message: "Repayment successful", repayment });
  } catch (error) {
    console.error("Error processing repayment:", error);
    res.status(500).json({ message: "Error processing repayment", error });
  }
});

// GET /loans/repayments/:loanId - Get loan repayment history for a specific loan
router.get("/loans/repayments/:loanId", async (req, res) => {
  const { loanId } = req.params;

  try {
    const user = await User.findOne({ "loanRepayments.loanId": loanId }, { loanRepayments: 1 });
    if (!user || !user.loanRepayments.length) {
      return res.status(404).json({ message: "No repayments found for this loan" });
    }

    const repayments = user.loanRepayments.filter(rep => rep.loanId.equals(loanId));

    res.status(200).json({ repayments });
  } catch (error) {
    res.status(500).json({ message: "Error fetching repayment history", error });
  }
});


// GET /loans/user/:userId - Get all loans for a specific user
router.get("/loans/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId, { loans: 1 });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ loans: user.loans });
  } catch (error) {
    res.status(500).json({ message: "Error fetching loans", error });
  }
});

// Request Password Reset Endpoint
router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body;

  // Validate request
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a token and expiry date
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour

    // Save the user with the token and expiry
    await user.save();

    // Send email with reset link
    const resetUrl = `${process.env.FRONTEND_URL}/password-reset/${token}`;
    const subject = "Password Reset Request";
    const text = `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}`;
    const html = `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p>`;
    
    await sendEmail(email, subject, text, html);

    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    res.status(500).json({ message: "Error requesting password reset", error });
  }
});

// Reset Password Endpoint
router.post('/password-reset/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  // Validate request
  if (!newPassword) {
    return res.status(400).json({ message: "New password is required" });
  }

  try {
    // Find the user by reset token and check if the token is expired
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() } // Check if token is still valid
    });
    
    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.passwordResetToken = undefined; // Clear reset token
    user.passwordResetExpires = undefined; // Clear reset token expiry

    // Save the new password
    await user.save();

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Error resetting password", error });
  }
});

module.exports = router;
