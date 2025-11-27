import {Router} from 'express';
import {signIn, signUp} from '../controllers/authController.js';
import {deleteUserController} from '../controllers/profileController.js';

const router = Router();

router.post('/signup', signUp);
router.post('/login', signIn);
router.delete('/user/:userId', deleteUserController);

export default router;

