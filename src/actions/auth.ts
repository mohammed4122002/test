'use server';

import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, createSession, deleteSession } from '@/lib/auth';
import { signUpSchema, signInSchema } from '@/lib/validations';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signUp(formData: FormData) {
  try {
    const data = signUpSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
    });

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { error: 'Email already registered' };
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });

    // Create cart for new user
    await prisma.cart.create({
      data: {
        userId: user.id,
      },
    });

    // Create wishlist for new user
    await prisma.wishlist.create({
      data: {
        userId: user.id,
      },
    });

    const sessionToken = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unexpected error occurred' };
  }
}

export async function signIn(formData: FormData) {
  try {
    const data = signInSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return { error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(data.password, user.password);

    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    const sessionToken = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unexpected error occurred' };
  }
}

export async function signOut() {
  await deleteSession();
  const cookieStore = await cookies();
  cookieStore.delete('session');
  redirect('/');
}

export async function createInitialAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    return;
  }

  const hashedPassword = await hashPassword(adminPassword);

  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      firstName: 'Admin',
    },
  });
}
