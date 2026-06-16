// =========================================================
// CONFIGURASI KEAMANAN & PASSWORD ADMIN SKY FLAPPY
// =========================================================

const ADMIN_CONFIG = {
    // Silakan ganti password di bawah ini sesuai keinginan Anda
    password: "valdydewa123",
    
    // Nama admin yang akan ditampilkan pada pop-up
    adminName: "Rivaldy Ganteng"
};

/**
 * Fungsi untuk memverifikasi apakah password yang dimasukkan benar
 * @param {string} inputPassword - Password yang dimasukkan oleh user
 * @returns {boolean} - True jika benar, False jika salah
 */
function verifyAdminPassword(inputPassword) {
    return inputPassword === ADMIN_CONFIG.password;
}
