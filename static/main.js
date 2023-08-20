fetch( 'https://api.github.com/repositories/42366054/releases?per_page=1' )
	.then( function( response )
	{
		return response.json();
	} )
	.then( function( response )
	{
		if( response.length )
		{
			response = response[ 0 ];

			const date = new Date( response.published_at );

			for( const asset of response.assets )
			{
				if( asset.name === 'VRF.exe' )
				{
					document.getElementById( 'js-download' ).href = asset.browser_download_url;
					document.getElementById( 'js-download-header' ).href = asset.browser_download_url;

					const version = document.querySelector( '.download-version' );
					version.href = response.html_url;

					let string = `View release notes for v${response.tag_name}`;

					if( window.innerWidth > 500 )
					{
						string += `, released on ${date.toLocaleDateString()}`;
					}

					version.textContent = string;

					break;
				}
			}
		}
	} );
