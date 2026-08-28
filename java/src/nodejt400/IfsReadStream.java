package nodejt400;

import java.sql.Connection;
import java.util.Arrays;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.IFSFile;
import com.ibm.as400.access.IFSFileInputStream;

public class IfsReadStream {

	private ConnectionProvider connectionProvider;
	private final Connection connection;
	private int bufferSize = 10000;
	byte[] buffer = new byte[bufferSize];
	private final IFSFileInputStream fis;
	private boolean closed = false;

	public IfsReadStream(ConnectionProvider connectionProvider, String fileName)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		boolean opened = false;
		try {
			AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
			AS400 as400 = handle.getSystem();
			IFSFile file = new IFSFile(as400, fileName);
			fis = new IFSFileInputStream(file);
			opened = true;
		} finally {
			if (!opened) {
				// The caller never receives this object, so nothing else can
				// return the connection on its behalf.
				closed = true;
				returnConnectionQuietly();
			}
		}
	}

	public byte[] read() throws Exception {
		try {
			int n = fis.read(buffer);
			if (n == -1) {
				closeAndReturnConnection();
				return null;
			} else if (n < bufferSize) {
				return Arrays.copyOf(buffer, n);
			}
			return buffer;
		} catch (Exception ex) {
			// The node side stops reading after a failure, so this is the last
			// chance to hand the connection back.
			closed = true;
			try {
				fis.close();
			} catch (Exception ignore) {
				// The connection matters more than the file handle.
			}
			returnConnectionQuietly();
			throw ex;
		}
	}

	private void closeAndReturnConnection() throws Exception {
		if (closed) {
			return;
		}
		closed = true;
		try {
			fis.close();
		} catch (Exception ignore) {
			// The connection matters more than the file handle.
		}
		connectionProvider.returnConnection(connection);
	}

	private void returnConnectionQuietly() {
		try {
			connectionProvider.returnConnection(connection);
		} catch (Exception ignore) {
			// Never mask the failure the caller is about to see.
		}
	}
}
