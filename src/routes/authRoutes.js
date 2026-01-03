import {Router} from 'express';
import {signIn, signUp, updateEmail, updatePassword, forgotPassword, resetPasswordController, logoutFromAllDevicesController} from '../controllers/authController.js';
import {deleteUserController} from '../controllers/profileController.js';
import {authenticate} from '../middlewares/auth.js';

const router = Router();

router.post('/signup', signUp);
router.post('/login', signIn);
router.post('/change-email', updateEmail);
router.post('/change-password', updatePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordController);
router.post('/logout-all-devices', authenticate, logoutFromAllDevicesController);
router.delete('/user/:userId', deleteUserController);

export default router;

