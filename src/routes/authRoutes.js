import {Router} from 'express';
import {signIn, signUp, updateEmail, updatePassword} from '../controllers/authController.js';
import {deleteUserController} from '../controllers/profileController.js';

const router = Router();

router.post('/signup', signUp);
router.post('/login', signIn);
router.post('/change-email', updateEmail);
router.post('/change-password', updatePassword);
router.delete('/user/:userId', deleteUserController);

export default router;

