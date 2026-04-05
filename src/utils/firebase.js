import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  signInAnonymously,
  linkWithPopup,
  signInWithCredential,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  collection, 
  getDocs,
  addDoc,
  deleteDoc
} from 'firebase/firestore';


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase 설정 누락 경고
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('your_api_key')) {
  console.warn("⚠️ Firebase configuration is missing or using placeholders! Please check your .env file.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

/**
 * 구글 팝업 로그인 (일반 로그인)
 */
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

/**
 * 익명(게스트) 로그인
 */
export const loginAnonymously = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Anonymous login failed", error);
    throw error;
  }
};

/**
 * 특정 UID의 랭킹/최고점수 정보를 Firestore에서 가져옴
 * @param {string} uid - 조회할 유저 UID
 * @returns {{ bestScore: number|null, displayName: string|null }}
 */
export const fetchUserBestScore = async (uid) => {
  try {
    const rankRef = doc(db, 'rankings', uid);
    const rankSnap = await getDoc(rankRef);
    if (rankSnap.exists()) {
      const data = rankSnap.data();
      return {
        bestScore: data.ms ?? null,
        displayName: data.displayName ?? null,
      };
    }
    return { bestScore: null, displayName: null };
  } catch (error) {
    console.error("fetchUserBestScore 실패:", error);
    return { bestScore: null, displayName: null };
  }
};

/**
 * 게스트 데이터를 구글 계정 UID로 이관하거나, 구글 계정 데이터를 유지함
 * @param {string} guestUid - 게스트 UID
 * @param {string} googleUid - 구글 계정 UID
 * @param {'guest'|'google'} keepSource - 어떤 데이터를 최종적으로 유지할지
 */
export const migrateUserData = async (guestUid, googleUid, keepSource) => {
  try {
    console.log(`🔄 데이터 이관 시작: source=${keepSource}, guest=${guestUid}, google=${googleUid}`);

    if (keepSource === 'guest') {
      // 게스트 records 컬렉션을 구글 UID로 복사
      const guestRecordsRef = collection(db, `users/${guestUid}/records`);
      const googleRecordsRef = collection(db, `users/${googleUid}/records`);
      const guestSnap = await getDocs(guestRecordsRef);

      // 기존 구글 기록 삭제
      const googleSnap = await getDocs(googleRecordsRef);
      const deletePromises = googleSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      console.log("✅ 기존 구글 기록 삭제 완료");

      // 게스트 기록을 구글 UID로 복사
      const copyPromises = guestSnap.docs.map(d => addDoc(googleRecordsRef, d.data()));
      await Promise.all(copyPromises);
      console.log("✅ 게스트 기록 → 구글 계정으로 복사 완료");

      // rankings 문서를 게스트 기준으로 덮어쓰기
      const guestRankRef = doc(db, 'rankings', guestUid);
      const guestRankSnap = await getDoc(guestRankRef);
      if (guestRankSnap.exists()) {
        await setDoc(doc(db, 'rankings', googleUid), {
          ...guestRankSnap.data(),
          uid: googleUid, // UID는 구글로 교체
        });
        console.log("✅ rankings 문서 이관 완료");
      }

      // 게스트 랭킹 문서 삭제
      await deleteDoc(guestRankRef);
      console.log("✅ 게스트 랭킹 문서 삭제 완료");

    } else {
      // 구글 데이터 유지: 게스트 records/rankings만 삭제
      const guestRecordsRef = collection(db, `users/${guestUid}/records`);
      const guestSnap = await getDocs(guestRecordsRef);
      const deletePromises = guestSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      const guestRankRef = doc(db, 'rankings', guestUid);
      await deleteDoc(guestRankRef);
      console.log("✅ 게스트 데이터 삭제 완료 (구글 데이터 유지)");
    }

    console.log("🎉 데이터 이관 완료!");
  } catch (error) {
    console.error("migrateUserData 실패:", error);
    throw error;
  }
};

/**
 * 게스트 계정을 구글 계정으로 연동 시도
 * - 성공: { status: 'linked', user }
 * - 충돌 (이미 사용중인 계정): { status: 'conflict', credential, googleUid, guestUid }
 */
export const linkWithGoogleAccount = async () => {
  if (!auth.currentUser) return;
  const guestUid = auth.currentUser.uid;

  try {
    const result = await linkWithPopup(auth.currentUser, provider);
    console.log("✅ 계정 연동 성공:", result.user.uid);
    return { status: 'linked', user: result.user };
  } catch (error) {
    if (error.code === 'auth/credential-already-in-use') {
      // 충돌 발생: credential을 꺼내서 구글 UID 조회
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.warn("⚠️ 계정 연동 충돌: 이미 존재하는 구글 계정");

      // 임시로 구글 계정에 로그인해서 UID 확인
      let googleUid = null;
      try {
        const tempResult = await signInWithCredential(auth, credential);
        googleUid = tempResult.user.uid;
        console.log("🔍 기존 구글 계정 UID 확인:", googleUid);
      } catch (innerError) {
        console.error("임시 로그인 실패:", innerError);
      }

      return { 
        status: 'conflict', 
        credential, 
        googleUid, 
        guestUid 
      };
    }
    console.error("Linking failed", error);
    throw error;
  }
};

/**
 * 닉네임 변경 (Auth 프로필 + Firestore rankings 동기화)
 * @param {string} nickname - 새 닉네임
 */
export const updateNickname = async (nickname) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    // 1. Auth 프로필 업데이트
    await updateProfile(auth.currentUser, {
      displayName: nickname
    });

    // 2. 랭킹 데이터 동기화 (존재할 경우)
    const rankRef = doc(db, 'rankings', uid);
    const rankSnap = await getDoc(rankRef);
    if (rankSnap.exists()) {
      await updateDoc(rankRef, {
        displayName: nickname
      });
    }
  } catch (error) {
    console.error("Update profile failed", error);
    throw error;
  }
};

/**
 * 로그아웃
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
    throw error;
  }
};
